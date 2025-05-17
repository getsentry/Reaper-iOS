//
//  EMGReaperConfig.m
//  PerfTesting
//
//  Created by Noah Martin on 1/22/25.
//

#import "EMGReaperConfig.h"

@implementation EMGReaperConfig

+ (instancetype)defaultConfig {
  EMGReaperConfig *config = [[EMGReaperConfig alloc] init];
  config.samplePercentage = 1;
  config.batchWindow = 0;
  return config;
}

static NSString *EMGReaperConfigKey = @"EMGReaperConfig";

+ (instancetype)fromUserDefaults {
  NSDictionary *configDictionary = [[NSUserDefaults standardUserDefaults] dictionaryForKey:EMGReaperConfigKey];
  return [EMGReaperConfig fromDictionary:configDictionary];
}

+ (instancetype)fromDictionary:(NSDictionary *)configJson {
  EMGReaperConfig *config = [EMGReaperConfig defaultConfig];
  id samplePercentageObject = [configJson objectForKey:@"samplePercentage"];
  if (samplePercentageObject) {
    config.samplePercentage = [samplePercentageObject doubleValue];
  }
  id batchWindowObject = [configJson objectForKey:@"batchWindow"];
  if (batchWindowObject) {
    config.batchWindow = [batchWindowObject intValue];
  }
  return config;
}

- (void)saveToUserDefaults {
  NSMutableDictionary *dictionary = [NSMutableDictionary dictionary];
  [dictionary setObject:@(self.samplePercentage) forKey:@"samplePercentage"];
  [dictionary setObject:@(self.batchWindow) forKey:@"batchWindow"];
  [[NSUserDefaults standardUserDefaults] setObject:dictionary forKey:EMGReaperConfigKey];
}

@end
