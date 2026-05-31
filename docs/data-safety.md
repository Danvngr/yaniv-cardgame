# Google Play Data Safety Notes

Use this document as a guide when filling out the Google Play Data Safety form.

This is not legal advice. Review the final answers before submission.

## Does The App Collect User Data?

Yes.

The app collects data needed for account login, online multiplayer gameplay, friend invitations, chat, scores, and game history.

## Does The App Share User Data?

Recommended answer: No.

The app does not sell user data and does not share user data with advertisers. Firebase and the multiplayer server are service providers used to operate the app.

## Is Data Encrypted In Transit?

Recommended answer: Yes.

Firebase and the production server use encrypted network communication.

## Can Users Request Data Deletion?

Recommended answer: Yes.

Users can request deletion by contacting:

zfzjk8@gmail.com

## Data Types To Declare

### Personal Info

Data collected:

- Email address, if provided through authentication.
- Username.
- Avatar.

Purpose:

- App functionality.
- Account management.

### User IDs

Data collected:

- Firebase user ID or app user ID.

Purpose:

- App functionality.
- Account management.
- Multiplayer room identity.

### App Activity

Data collected:

- Game activity.
- Scores.
- Game history.
- Player statistics.
- Room and match activity.

Purpose:

- App functionality.
- Analytics within the app, such as personal stats and game history.

### User-Generated Content

Data collected:

- In-game chat messages.

Purpose:

- App functionality.
- Multiplayer communication inside game rooms.

### Contacts

Recommended answer: No.

The app does not access the user's phone contacts. Friend features are internal to the app.

### Location

Recommended answer: No.

The app does not collect location data.

### Financial Info

Recommended answer: No.

The app does not collect payment or financial information.

### Photos And Videos

Recommended answer: No.

The app does not collect photos or videos.

### Audio Files Or Microphone

Recommended answer: No.

The app plays audio but does not record audio or use the microphone.

### Device Or Other IDs

Recommended answer: Only if Google Play asks because Firebase/Auth/server logs use device or installation identifiers.

If asked, select app functionality and security/fraud prevention as the purpose.

## Account Creation

Recommended answer: Yes, account creation is required for online features.

If the store asks whether users can use the app without an account, answer based on the final app behavior. If offline/local gameplay is available without login, mention that only online features require an account.

## Data Deletion Instructions

Users can request account or data deletion by emailing:

zfzjk8@gmail.com

Suggested response text for the store:

"Users can request deletion of their account and related personal data by contacting us at zfzjk8@gmail.com."
