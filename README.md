# Customer Engagement Analytics

  The Customer Engagement Analytics Demo brings IBM Watson Tone Analyzer and IBM Watson Discover services together for customer engagement analytics. It provides visual insights on chat quality monitoring, customer satisfaction measurement, agent performance evaluation and customer engagement tracking.

## Getting Started

1. You need a Bluemix account. If you don't have one, [sign up][sign_up]. Experimental Watson services are free to use.

2. Download and install the [Cloud-foundry CLI][cloud_foundry] tool if you haven't already.

3. Edit the `manifest.yml` file and change `<application-name>` to something unique. The name you use determines the URL of your application. For example, `<application-name>.mybluemix.net`.

  ```yaml
  applications:
 - name: <application-name>
   memory: 512MB
  ```

4. Connect to Bluemix with the command line tool.

  ```sh
  cf api https://api.ng.bluemix.net
  cf login
  ```

5. Create and retrieve service keys to access the [Tone Analyzer][tone_analyzer_service_url] service:

  ```none
  cf create-service tone_analyzer standard my-ta-service
  cf create-service-key my-ta-service myKey
  cf service-key my-ta-service myKey
  ```

6. Create and retrieve service keys to access the [Discovery][discovery_service_url] service:

  ```none
  cf create-service discovery standard my-discovery-service
  cf create-service-key my-discovery-service myKey
  cf service-key my-discovery-service myKey
  ```
7. Create an [environment](https://www.ibm.com/watson/developercloud/discovery/api/v1/?curl#create_environment) and a [collection](https://www.ibm.com/watson/developercloud/discovery/api/v1/?curl#create-collection) using your Discovery service keys.

8. Create a `.env` file in the root directory by copying the sample `.env.example` file using the following command:

  ```none
  cp .env.example .env
  ```
  You will update the `.env` with the information you retrieved in steps 5, 6 and 7

  The `.env` file will look something like the following:

  ```none
MY_TONE_ANALYZER_USERNAME=<username>
MY_TONE_ANALYZER_PASSWORD=<password>
MY_DISCOVERY_USERNAME=<username>
MY_DISCOVERY_PASSWORD=<password>
MY_ENVIRONMENT_ID=<environment_id>
MY_COLLECTION_ID=<collection_id>
  ```

9. Install the dependencies your application need:

  ```none
  npm install
  ```

10. Skip this step if you will use the default conversations provided for this demo under the public/data/conversations folder. If you prefer to load the demo with your own data, please follow instruction.txt and replace 'input_sample.csv' under the public/data/ folder by your own data; also remove all default data under the public/data/conversations folder. Then run the processing script:

  ```none
  npm run analyzeTones
  ```
11. Go to [Disovery Tooling](https://discovery-tooling.mybluemix.net/) and select your Discovery collection. Upload all JSON files under the resources/conversations folder.

12. Start the application locally:

  ```none
  npm start
  ```

13. Point your browser to [http://localhost:3000](http://localhost:3000).
14. **Optional:** Push the application to Bluemix:

  ```none
  cf push
  ```

After completing the steps above, you are ready to test your application. Start a browser and enter the URL of your application.

            <your application name>.mybluemix.net


For more details about developing applications that use Watson Developer Cloud services in Bluemix, see [Getting started with Watson Developer Cloud and Bluemix][getting_started].


## Troubleshooting

* The main source of troubleshooting and recovery information is the Bluemix log. To view the log, run the following command:

  ```sh
  cf logs <application-name> --recent
  ```

* For more details about the service, see the [documentation][docs] for the Tone Analyzer service and the [documentation][docs2] for the Discovery service.


----


## License

  This sample code is licensed under Apache 2.0.

## Contributing

  See [CONTRIBUTING](.github/CONTRIBUTING.md).

## Open Source @ IBM
  Find more open source projects on the [IBM Github Page](http://ibm.github.io/)

## Privacy Notice

Sample web applications that include this package may be configured to track deployments to [IBM Bluemix](https://www.bluemix.net/) and other Cloud Foundry platforms. The following information is sent to a [Deployment Tracker](https://github.com/IBM-Bluemix/cf-deployment-tracker-service) service on each deployment:

* Node.js package version
* Node.js repository URL
* Application Name (`application_name`)
* Space ID (`space_id`)
* Application Version (`application_version`)
* Application URIs (`application_uris`)
* Labels of bound services
* Number of instances for each bound service and associated plan information

This data is collected from the `package.json` file in the sample application and the `VCAP_APPLICATION` and `VCAP_SERVICES` environment variables in IBM Bluemix and other Cloud Foundry platforms. This data is used by IBM to track metrics around deployments of sample applications to IBM Bluemix to measure the usefulness of our examples, so that we can continuously improve the content we offer to you. Only deployments of sample applications that include code to ping the Deployment Tracker service will be tracked.

[deploy_track_url]: https://github.com/cloudant-labs/deployment-tracker
[cloud_foundry]: https://github.com/cloudfoundry/cli
[getting_started]: https://www.ibm.com/watson/developercloud/doc/getting_started/
[docs]: http://www.ibm.com/watson/developercloud/tone-analyzer/
[docs2]: http://www.ibm.com/watson/developercloud/discovery/
[sign_up]: https://console.ng.bluemix.net/registration/
[tone_analyzer_service_url]: http://www.ibm.com/watson/developercloud/tone-analyzer.html
[discovery_service_url]: http://www.ibm.com/watson/developercloud/discovery.html
