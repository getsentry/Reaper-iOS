# Reaper

A framework for detecting dead code at runtime. Read more about it in the [launch blog post](https://www.emergetools.com/blog/posts/dead-code-detection-with-reaper).

The framework detects the set of classes that are used, and the `Scripts` directory in this repo contains a program to determine the set of all possible types that reaper can detect.
The difference of these sets are the unused types. 

## Installation

### Swift Package Manager

Add Reaper as a dependency with Swift package manager using the URL https://github.com/EmergeTools/Reaper

### CocoaPods

Add Reaper to your Podfile:

```Ruby
target 'MyApp' do
  pod 'Reaper', '~> 1.6'
end
```

### XCFramework

Download the latest XCFramework from [Github releases](https://github.com/EmergeTools/Reaper/releases).

## Setup

Start the SDK at app launch by adding the following code:

```Swift
import Reaper

...

EMGReaper.sharedInstance().start { types in
  // Handle list of used types
}
```

## Determining all types

Run `tsc ./Scripts/main.ts` then `node ./Scripts/main.ts PATH_TO_YOUR_APP.app`
