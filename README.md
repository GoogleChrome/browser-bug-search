# Browser Bug Searcher

Demo: https://browser-issue-tracker-search.appspot.com

## Contributing

1. Install the [App Engine Python SDK](https://cloud.google.com/appengine/downloads).
2. Install Bower if you don't already have it: `npm install bower -g` or `yarn global add bower`

Now run:

    npm install

or

    yarn


### Deployment

> Note: you need to be an admin of the App Engine project to deploy.

Build the site:

    gulp

You'll need to do this every time you change parts of the app.

Then, in the main project root, run the GAE dev server:

    dev_appserver.py .

### Deploy

To deploy the site, update app.yaml with a new version and run:

    npm run deploy

Then switch the default serving version in the Google Developer Console.

- - -

License: Apache 2.0 - See [/LICENSE](/LICENSE).

Author: [Eric Bidelman](https://github.com/ebidel).

Please note: this is not an official Google product.
