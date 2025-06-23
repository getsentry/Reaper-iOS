// swift-tools-version:5.7.1
import PackageDescription

let package = Package(
    name: "Reaper",
    platforms: [
        .iOS(.v13),
    ],
    products: [
        .library(
            name: "Reaper",
            targets: ["Reaper"]),
    ],
    targets: [
        .target(
          name: "Reaper", dependencies: ["ReaperSwift"]),
        .target(name: "ReaperSwift"),
    ]
)
