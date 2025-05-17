//
//  EMGReaperBatch.m
//  PerfTesting
//
//  Created by Noah Martin on 1/22/25.
//

#import "EMGReaperBatch.h"

@interface EMGReaperBatch ()

@property (nonatomic, strong) NSDate *date;
@property (nonatomic, strong) NSMutableSet<NSString *> *types;

@end

static NSString *EMGReaperBatchDateKey = @"EMGReaperBatchDate";
static NSString *EMGReaperBatchTypesKey = @"EMGReaperBatchTypes";

@implementation EMGReaperBatch

- (instancetype)init {
  if (self = [super init]) {
    self.date = NSDate.now;
    self.types = NSMutableSet.new;
    return self;
  }
  return nil;
}

+ (instancetype)fromDisk {
  EMGReaperBatch *batch = [[EMGReaperBatch alloc] init];
  NSDate *batchDate = [[NSUserDefaults standardUserDefaults] objectForKey:EMGReaperBatchDateKey];
  if (batchDate) {
    batch.date = batchDate;
  }
  NSArray *types = [[NSUserDefaults standardUserDefaults] arrayForKey:EMGReaperBatchTypesKey];
  if (types) {
    batch.types = [NSMutableSet setWithArray:types];
  }
  return batch;
}

- (void)addTypes:(NSArray<NSString *> *)types {
  [self.types addObjectsFromArray:types];
}

- (NSArray<NSString *> *)allTypes {
  return [self.types allObjects];
}

- (void)clearFromDisk {
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:EMGReaperBatchDateKey];
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:EMGReaperBatchTypesKey];
}

- (void)saveBatch {
  [[NSUserDefaults standardUserDefaults] setObject:self.date forKey:EMGReaperBatchDateKey];
  [[NSUserDefaults standardUserDefaults] setObject:[self allTypes] forKey:EMGReaperBatchTypesKey];
}

- (BOOL)shouldKeepBatching:(EMGReaperConfig *)config {
  if (config.batchWindow == 0) {
    return NO;
  }
  int timeSinceBatch = (-1 * [self.date timeIntervalSinceNow]);
  if (timeSinceBatch < config.batchWindow) {
    NSLog(@"[Reaper] skipping upload due to batch window");
    return YES;
  }
  return NO;
}

@end
