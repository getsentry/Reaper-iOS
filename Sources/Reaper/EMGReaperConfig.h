//
//  EMGReaperConfig.h
//  PerfTesting
//
//  Created by Noah Martin on 1/22/25.
//

#import <Foundation/Foundation.h>

@interface EMGReaperConfig: NSObject
  @property (nonatomic) double samplePercentage;
  @property (nonatomic) int batchWindow;

  + (instancetype)fromUserDefaults;
  + (instancetype)fromDictionary:(NSDictionary *)configJson;
  - (void)saveToUserDefaults;
@end
