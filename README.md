# Basic Analytics Script

This repository provides a very basic analytics generation script. You can use
the script to generate CSV files that contain simple analytics about Cord usage.
This script operates using a Customer ID and Customer Secret. These are _not_
the same thing as application IDs and application secrets. If you don't have
access to your customer ID and secret, please message us.

With your Customer ID and Secret, this script will enumerate all of your
applications. For each application, it will pull key metrics like number of
users, number of messages, etc..

The data provided by this script includes:

- ID (the ID of the application)
- Name (the name of the application)
- Total User Count
- Active User Count
- Deleted User Count
- Total Group Count (user groups, formerly referred to as "orgs" or "organizations")
- Active Group Count
- Deleted Group Count
- Slack Connected Group Count
- Total Thread Count
- Total Resolved Thread Count
- Total Message Count
- Total Deleted Message Count
- Total User Messages Count
- Total Action Messages Count
- Total Thread Participants Count
- Total Messages Count
- Total Mention Messages Count
- Total Reactions Count
- Total Attachments Count

## To run the script

This script is built in plain JavaScript using NodeJS.

1. Install NodeJS: To run this script, you'll first need to install a [NodeJS](https://nodejs.org/) run-time applicable to your machine.
1. Run `npm install`: This script has a small number of dependencies (see package.json) which must be installed to execute the script.
1. Setup your `.env` file. You can copy the `.env.example` file and paste in your Customer ID and Customer Secret.
1. Choose an output file. For example, "analytics.csv"
1. Run `node analytics.js --outputFile=analytics.csv`

If all has gone well, you'll see colourful and informative output giving you insight into the status of the script as it executes.

## Caveats

Please bear in mind, for very large customers with lots of applications, this script may take some time to execute.

Also, the internet is not infallible and sometimes requests fail. This script with attempt to retry failed network operations one time. If you're running this script flaky WiFi, for instance, you may find that it errors and needs to be re-run.

This script is not exhaustive. It was created as a stop-gap solution while we build a data-rich analytics UI into our developer console. You very likely will want to alter this script to include data that you need. I've attempted to keep it very simple and straightforward so that modifying it is as easy as possible.

If you run into any issues, please ping me in Slack or email me (jack [at] cord [dot] com).
