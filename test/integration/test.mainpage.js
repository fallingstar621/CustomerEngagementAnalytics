/* eslint no-undef: 0 */
/* eslint prefer-arrow-callback: 0 */
casper.test.begin('Customer Engagement Demo', 2, function suite(test) {
  const baseHost = 'http://localhost:3000';

  casper.start(baseHost, function () {
    casper.test.comment('Starting Testing');
    test.assertHttpStatus(200, 'Customer Engagement Analytics Demo is up');
    test.assertTitle('Customer Engagement Analytics', 'Title is correct');
  });

  casper.run(function () {
    test.done();
  });
});
