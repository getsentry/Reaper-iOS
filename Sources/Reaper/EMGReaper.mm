#import "EMGReaper.h"
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <mach-o/dyld.h>
#import <mach-o/dyld_images.h>
#import <mach-o/getsect.h>
#import "EMGObjcRuntimeTypes.h"
#import "EMGReaperConfig.h"
#import "EMGReaperBatch.h"

// Forward declare this, the implementation is in Swift
@interface NameFinder

+ (NSString *)getNameWithPtr:(uint64_t)ptr qualified:(BOOL)qualified;

@end

@implementation EMGReaper {
    NSString *_APIKey;
    NSURLSession *_session;
    dispatch_queue_t _queue;
    NSMutableSet <NSString *> *_usedTypesReported;
    EMGReaperConfig *_config;
    NSString *_uuid;
    EMGReaperBatch *_batch;
    HandleTypes _handleTypes;
}

+ (instancetype)sharedInstance
{
    static dispatch_once_t onceToken;
    static EMGReaper *sSharedInstance;
    dispatch_once(&onceToken, ^{
        sSharedInstance = [[EMGReaper alloc] init];
    });
    return sSharedInstance;
}

#if DEBUG
__used __attribute__((constructor)) void EMGGo() {
    // Give a little more time for the system to set up
    dispatch_async(dispatch_get_main_queue(), ^{
        [[EMGReaper sharedInstance] startWithAPIKey:@"12345"];
    });
}
#endif

- (void)startWithHandler:(HandleTypes)handleTypes {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
      NSInteger majorVersion = [[NSProcessInfo processInfo] operatingSystemVersion].majorVersion;
      if (majorVersion != 15 && majorVersion != 16 && majorVersion != 17 && majorVersion != 18) {
          return;
      }
      NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration ephemeralSessionConfiguration];
      _session = [NSURLSession sessionWithConfiguration:configuration];
      _uuid = [NSUUID UUID].UUIDString;
      _handleTypes = handleTypes;

      dispatch_queue_attr_t attr = dispatch_queue_attr_make_with_qos_class(NULL, QOS_CLASS_UTILITY, 0);
      _queue = dispatch_queue_create("com.emergetools.reaper", attr);

      _usedTypesReported = [NSMutableSet set];
      _config = [EMGReaperConfig fromUserDefaults];

      [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(didEnterBackground)
                                                   name:UIApplicationDidEnterBackgroundNotification
                                                 object:nil];

      [[NSNotificationCenter defaultCenter] addObserver:self
                                               selector:@selector(willTerminate)
                                                   name:UIApplicationWillTerminateNotification
                                                 object:nil];
  });
}

- (void)startWithAPIKey:(NSString *)APIKey
{
    _APIKey = APIKey;
  [self startWithHandler:^(NSArray<NSString *> *types) {
    [self uploadTypes:types];
  }];
}

- (void)didEnterBackground
{
    [self enqueueUploadReport];
}

- (void)willTerminate
{
    [self enqueueUploadReport];
}

- (void)enqueueUploadReport
{
    // -uploadReportSynchronously took 60ms, so maybe just better to run it in the background
    dispatch_async(_queue, ^{
        @try {
            [self uploadReport];
        } @catch (NSException *exception) {
            // TODO: send up error reports?
        }
    });
}

uint8_t *get_objc_section(mach_header_64 *header, const char *section, unsigned long *size) {
  uint8_t *section_data = getsectiondata(header, "__DATA", section, size);
  if (section_data) {
    return section_data;
  }
  section_data = getsectiondata(header, "__DATA_CONST", section, size);
  return section_data;
}

// Not all Swift types with singleton metadata are supported
// More support could be added, but the format of the metadata
// is trickier and the relative benefit is small.
bool is_swift_singleton_attributable(swift_type *swift_desc) {
  return !swift_desc->flags.is_generic() && !swift_desc->flags.has_resilient_superclass() && !swift_desc->flags.has_foreign_metadata_initialization();
}

// Precondition: is_swift_singleton_attributable must be true and the type must be class/struct/enum
bool is_swift_singleton_used(swift_type *swift_desc) {
  int size = 0;
  switch (swift_desc->flags.kind()) {
    case 16:
      size = sizeof(swift_class_descriptor);
      break;
    case 17:
      size = sizeof(swift_struct_descriptor);
      break;
    case 18:
      size = sizeof(swift_enum_descriptor);
      break;
    default:
      return true;
  }
  target_singleton_metadata_initialization *singleton_metadata = (target_singleton_metadata_initialization *) (((char *) swift_desc) + size);
  int *cache = (int *) (((char *) singleton_metadata) + singleton_metadata->initialization_cache);
  return *cache != 0;
}

NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"\\.\\(unknown context at \\$[0-9a-fA-F]+\\)\\." options:0 error:nil];

NSString *removeUnknownContext(NSString *input) {
  if (regex) {
    return [regex stringByReplacingMatchesInString:input options:0 range:NSMakeRange(0, [input length]) withTemplate:@"."];
  }
  return input;
}

- (NSArray *)usedSwiftTypesInBinary:(const struct mach_header_64 *)header {
  NSMutableArray <NSString *> *usedTypes = [NSMutableArray array];
  unsigned long size;
  uint8_t *section_data = getsectiondata(header, "__TEXT", "__swift5_types", &size);
  if (!section_data) {
    return usedTypes;
  }

  unsigned long swiftTypesInBinaryCount = size/sizeof(int32_t);
  for (int i = 0; i < swiftTypesInBinaryCount; i++) {
    int32_t *offset = (((int32_t *) section_data) + i);
    swift_type *swift_desc = (swift_type *) ((char *) offset + *offset);
    auto kind = swift_desc->flags.kind();
    // Struct or Enum
    if (kind == 17 || kind == 18) {
      // Can only attribute types with singleton metadata initialization
      if (swift_desc->flags.has_singleton_metadata_initialization()) {
        if (is_swift_singleton_attributable(swift_desc)) {
          if (is_swift_singleton_used(swift_desc)) {
            // 4 * 3 is the offset of the accessFunction in a swift_desc (3 int32_t fields)
            uint64_t (*accessFunc)(void) = (uint64_t (*)(void)) (((char *) swift_desc + 4 * 3) + swift_desc->accessFunction);
            NSString *name = [NameFinder getNameWithPtr:accessFunc() qualified:YES];
            if (name) {
              [usedTypes addObject:removeUnknownContext(name)];
            }
          }
        }
      }
    }
  }
  return usedTypes;
}

- (NSArray *)usedTypesInBinary:(const struct mach_header *)mach_header {
  // Reaper only supports 64 bit
#if !__LP64__
  return @[];
#endif

  unsigned long size;
  mach_header_64 *header = (mach_header_64 *)mach_header;
  NSMutableArray <NSString *> *usedTypes = [NSMutableArray array];
  [usedTypes addObjectsFromArray:[self usedSwiftTypesInBinary:header]];
  objc_class* *section_data = (objc_class* *) get_objc_section(header, "__objc_classlist", &size);
  if (!section_data) {
    return usedTypes;
  }
  unsigned long classesInBinaryCount = size/8;
  for (int i = 0; i < classesInBinaryCount; i++) {
      objc_class *classPtr = *(section_data + i);
      // Guard against the class being null
      if (!classPtr) {
        continue;
      }
      objc_class *metaClass = (__bridge objc_class *) object_getClass((__bridge id) classPtr);
      class_rw_t *writableClassData = metaClass->bits.data();
      BOOL isInitialized = !!(writableClassData->flags & (1<<29) /* RW_INITIALIZED */);
      // First check if the type is used by ObjC, if so it is always considered used
      if (isInitialized) {
        const char *name = classPtr->name();
        if (name) {
          [usedTypes addObject:@(name)];
        }
      } else if (classPtr->is_swift()) {
        // Some Swift classes have a secondary way of being marked used.
        swift_class_t *cls = ((swift_class_t *) classPtr);
        swift_type *swift_desc = (swift_type *) cls->description;
        if (swift_desc->flags.has_singleton_metadata_initialization()) {
          if (is_swift_singleton_attributable(swift_desc)) {
            if (is_swift_singleton_used(swift_desc)) {
              const char *name = classPtr->name();
              if (name) {
                [usedTypes addObject:@(name)];
              }
            }
          }
        }
      }
  }
  return usedTypes;
}

BOOL randomWithProbability(double probability) {
  if (probability < 0.0 || probability > 1.0) {
    NSLog(@"Probability must be between 0.0 and 1.0");
    return NO;
  }
  double randomValue = (double)arc4random() / UINT32_MAX;
  return randomValue < probability;
}

- (void)uploadReport
{
    if (!randomWithProbability(_config.samplePercentage)) {
        return;
    }

    unsigned int imageCount = _dyld_image_count();
    NSString *mainBinaryPath = [[[NSBundle mainBundle] executableURL] URLByDeletingLastPathComponent].path;
    NSMutableArray *usedTypes = [NSMutableArray array];
    for (int i = 0; i < imageCount; i++) {
      const char *name = _dyld_get_image_name(i);
      if (name) {
        NSString *imageName = [NSString stringWithUTF8String:name];
        if ([imageName hasPrefix:mainBinaryPath]) {
          const struct mach_header *header = _dyld_get_image_header(i);
          [usedTypes addObjectsFromArray:[self usedTypesInBinary:header]];
        }
      }
    }
    NSMutableArray <NSString *> *unreportedUsedTypes = [NSMutableArray array];
    for (NSString *usedType : usedTypes) {
        if (![_usedTypesReported containsObject:usedType]) {
            [unreportedUsedTypes addObject:usedType];
        }
    }

    // Avoid an API request if we have nothing new to report
    if (unreportedUsedTypes.count == 0) {
        return;
    }
    [_usedTypesReported addObjectsFromArray:unreportedUsedTypes];

    if (!_batch) {
      _batch = [EMGReaperBatch fromDisk];
    }
    [_batch addTypes:unreportedUsedTypes];
    if ([_batch shouldKeepBatching:_config]) {
      [_batch saveBatch];
      return;
    }
  
    NSArray<NSString *> *allTypes = [_batch allTypes];
  
    // Delete the current batch since it is being sent
    [_batch clearFromDisk];
    _batch = nil;
  
    _handleTypes(allTypes);
}

- (void)uploadTypes:(NSArray<NSString *> *)types {
  // CFBundleVersion is probably required for all builds, but just to be safe, fall back to CFBundleShortVersionString
  NSString *version = [[NSBundle mainBundle] infoDictionary][@"CFBundleVersion"] ?: @"unknown";
  NSString *shortVersionString = [[NSBundle mainBundle] infoDictionary][@"CFBundleShortVersionString"] ?: @"unknown";
  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
  NSDictionary *dictionary = @{
      @"seen": types,
      @"appId": bundleId,
      @"version": version,
      @"shortVersionString": shortVersionString,
      @"apiKey": _APIKey,
      // A single session can report multiple times, each time with only the new used classes reported
      // This keeps track of the session so we can tell all classes used during a session.
      @"uuid": _uuid,
  };

  NSString *apiPath = @"https://reaper.emergetools.com/report";
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:apiPath]];
  request.HTTPMethod = @"POST";
  [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
  [request setValue:@"deflate" forHTTPHeaderField:@"Content-Encoding"];
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:dictionary options:0 error:nil];
  NSError *error;
  NSData *compressedData = [jsonData compressedDataUsingAlgorithm:NSDataCompressionAlgorithmZlib error:&error];
  if (error) {
      NSLog(@"[Reaper] Error compressing data %@", error);
  } else {
    [[_session uploadTaskWithRequest:request fromData:compressedData completionHandler:^(NSData * _Nullable data, NSURLResponse * _Nullable response, NSError * _Nullable error) {
      if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;
        if (httpResponse.statusCode == 404) {
          NSLog(@"[Reaper] Error from Reaper API call. Ensure an app with bundle id %@ and version %@ has been uploaded to Emerge.", bundleId, shortVersionString);
        } else if (httpResponse.statusCode >= 400) {
          NSLog(@"[Reaper] Error uploading to Reaper API %ld", (long)httpResponse.statusCode);
        } else if (data && httpResponse.statusCode >= 200 && httpResponse.statusCode < 300) {
          NSDictionary *responseJson = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
          if (error) {
            NSLog(@"[Reaper] Error decoding response %@", error);
          } else {
            NSDictionary *configJson = responseJson[@"config"];
            if (configJson) {
              // Apply new config
              EMGReaperConfig *config = [EMGReaperConfig fromDictionary:configJson];
              dispatch_async(self->_queue, ^{
                [config saveToUserDefaults];
                self->_config = config;
              });
            }
          }
        }
      }
    }] resume];
  }
}

@end
