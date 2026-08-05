# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

## [3.1.2] - 2026-08-06

### Changed
- **Updated changelog**: The changelog has been updated to use a local JSON file for easier maintenance and to avoid issues with the Supabase backend.

## [3.1.1] - 2026-08-05

### Fixed
- **Improved food detection**: Food description analysis now works more reliably using your AI settings.

## [3.1.0] - 2026-08-05

### Added
- **Better barcode scanning**: The camera now automatically selects the best lens for scanning barcodes, making it faster and more reliable.
- **More reliable food logging**: Improved validation prevents errors when saving food items with unusual nutrition data.
- **Improved update process**: Updates now download and install more reliably, with clearer prompts.
- **Better barcode scanning reliability**: The scanner now focuses properly on close-up barcodes instead of starting on the wide-angle lens.
- **Enhanced security and privacy**: Improved security measures protect your data and prevent potential vulnerabilities.
- **Removed debug logging**: Removed internal diagnostic logging that could accidentally capture user data.
- **Improved accessibility**: Screen can now be zoomed in and out for better readability.
- **Removed non-functional button**: Removed the non-working 'Switch Camera' button from the barcode scanner.
- **Updated documentation**: Help documentation updated to reflect current app behavior.

## [3.0.0] - 2026-07-09

### Changed
- Improved the in-app update flow and removed the redundant update button from the update popup for a cleaner update experience.
- Updated secondary-muscle tracking for workout exercises.

### Fixed
- Barcode scanner camera improvements for more reliable code detection.
- Various bug fixes, style adjustments, and proxy / Playwright test updates.

## [2.2.1] - 2026-06-25

### Added
- **Update Feature**: You can now see the latest news about the project on the dashboard when clicking the "<i class="fa fa-refresh"></i>" button

## [2.2.0] - 2026-06-20

### Added
- **Food Favourites**: You can now save and favourite foods. A new modal gives you quick access to previously logged meals.
- **New Logo**: The logo has been redesigned to better reflect the design and goals of the project.

### Added
- **Break Timer for Workouts**: A break timer is now integrated into workouts. You can add or remove 15 seconds from your rest time or skip breaks entirely.
- **PR Tracking**: The app now automatically notifies you when you hit a personal record during a workout.

### Changed
- **Improved Page Transitions**: Updated page switch animations for already rendered components to feel smoother.
- **Supplements Tracking Improvements**: Supplements tracking is now more precise. Also fixed a bug that occurred when tracking was disabled.
- **CSV Export Fix**: Fixed data export putting JSON into a single column instead of the correct CSV structure.
- **Hydration Rendering Fix**: Fixed a hydration mismatch where server-side defaults conflicted with client-side localStorage values.

## [2.1.1] - 2026-07-01

### Added
- New in-app Update Center showing the latest updates and changelog.
- New exercises with instruction steps and a redesigned workout experience.
- Secondary-muscle tracking for workout exercises.
- Reverse geocoding on the weather widget for readable location names.

### Changed
- Performance enhancements, bug fixes, and visual improvements.

## [2.1.0] - 2026-06-15

### Added
- **Supplement Tracking**: New feature to track your supplements including dosage and frequency.
- **Playwright Testing**: Added automated testing via Playwright for better stability across the app.
- **Cookie Banner Update**: The cookie banner no longer shows up once you have already accepted it.
- **Glass Animation**: Added a smooth animation to the glass when using quick buttons.
- **Merged Download Button**: CalSync and DropSync downloads are now combined into a single button.
- **AI Supplement Awareness**: The AI now has access to supplement information for better recommendations.
- **Removed Copilot Instructions**: Cleaned up unnecessary Copilot instruction files from the project.
- **Quick Button Fixes**: Fixed issues with quick buttons on the dashboard and a missing hidden button when opening the drink modal.
- **Supabase Column Fix**: Fixed intensity values being written to a non-existent column in Supabase.
- **Footer Content Fix**: Fixed footer content not loading correctly.

## [2.0.0] - 2026-06-10

### Added
- **PWA Update Banner**: Added a banner to notify you about available updates for the PWA version of the app.
- **Current Weather Widget**: Added a small weather widget to the dashboard showing current conditions for your location.
- **Activity Status**: Added a status widget to the dashboard where you can track your current activity status (active, resting, injured). Supports date-specific entries and can be used to filter your health data.
- **Changelog Sync**: You can now see the latest changes directly in the app. The changelog is synced with the GitHub repository.

## [1.1.0] - 2026-06-05

### Fixed
- **Bug Fixes and Improvements**: Fixed issues with AI detection for self-hosted LLMs, date handling, and language spelling errors.

## [1.0.0] - 2026-06-01

### Added
- **Initial Release**: HealthSync launches with CalSync for calorie tracking and DropSync for hydration tracking as its core features.

## [0.1.0] - 2026-05-15

### Added
- **Initial HealthSync release**: Dashboard with health score, macro and hydration tracking, food logging (CalSync), hydration tracking (DropSync), workouts, and multiple themes.
- Weather widget and activity status tracking.
- AI detection for food descriptions via a self-hosted LLM.
- Supplement tracking, food favourites, workout break timer and PR tracking.
- Legal pages (privacy, cookies, terms, AI guidelines).
- Various fixes including CSV data export and cookie banner handling.