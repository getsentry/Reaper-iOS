//
//  EMGReaperBatch.h
//  PerfTesting
//
//  Created by Noah Martin on 1/22/25.
//

#import "EMGReaperConfig.h"

@interface EMGReaperBatch: NSObject

  + (instancetype)fromDisk;

  - (BOOL)shouldKeepBatching:(EMGReaperConfig *)config;
  - (void)addTypes:(NSArray<NSString *> *)types;
  - (NSArray<NSString *> *)allTypes;
  - (void)clearFromDisk;
  - (void)saveBatch;

@end
