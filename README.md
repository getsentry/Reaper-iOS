# Reaper

A framework for detecting dead code at runtime - Reaper is an SDK added to your app to report which Swift and Objective-C types were used for each user session. It supports all classes written in Objective-C, most non-generic Swift classes, and some Swift structs/enums.

The framework detects the set of classes that are used, and the `Scripts` directory in this repo contains a program to determine the set of all possible types that reaper can detect.
The difference of these sets are the unused types.

See additional [resources](#resources) below.

## Installation

### Swift Package Manager

Add Reaper as a dependency with Swift package manager using the URL https://github.com/getsentry/Reaper-iOS.git

### CocoaPods

Add Reaper to your Podfile:

```Ruby
target 'MyApp' do
  pod 'Reaper', '~> 2.0.1'
end
```

### XCFramework

Download the latest XCFramework from [Github releases](https://github.com/EmergeTools/Reaper/releases).

## Setup

* Fetch the repo locally, eg via `gh repo clone getsentry/Reaper-iOS`
* Navigate to the `Scripts` directory `cd Scripts`
* Install the dependencies with `npm install`
* Build the project `npm tsc --project .`
* If you haven't already, archive your app from Xcode. You might need to only export `arm64` slices
* Locate your .app, usually at `/Users/{you-user}/Library/Developer/Xcode/Archives/{date}/{app-name-and-date}.xcarchive/Products/Applications/{app-name}.app` 
* Scan for files with `node .build/main.js {your-app-path.app} output.json`
* You can ignore the errors if a `output.json` file has been created.

## Integration

Start the SDK at app launch by adding the following code:

```Swift
import Reaper

...

EMGReaper.sharedInstance().start { types in
  // Handle list of used types
}
```


## Resources

- [Example backend](https://github.com/getsentry/reaper-server)
- [Performance & Size Impact](https://docs.emergetools.com/docs/reaper#performance-impact)
- [Open sourcing Reaper](https://blog.sentry.io/an-open-source-sdk-for-finding-dead-code/)
- [Launch Blog Post](https://www.emergetools.com/blog/posts/dead-code-detection-with-reaper).
- [Reaper for Android](https://github.com/EmergeTools/emerge-android/tree/main/reaper)
