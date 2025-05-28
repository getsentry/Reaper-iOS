#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^HandleTypes)(NSArray<NSString *> *);

@interface EMGReaper : NSObject

+ (instancetype)sharedInstance;
- (void)startWithHandler:(HandleTypes)handleTypes;

- (instancetype)init NS_UNAVAILABLE;
+ (instancetype)new NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
