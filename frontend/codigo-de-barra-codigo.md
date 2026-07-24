pnpm i html5-qrcode


Documentation & Usage
[1] Add javascript to your webpage either using npm

You can install via npm or include the JavaScript script directly.
npm

Or include it via script tag:

<script src="html5-qrcode.min.js"></script>

[2] Add an empty div where you want to place the qrcode scanner

Create a container element with a specific ID where the scanner will be rendered.

<div id="reader" style="width: 600px"></div>

[3] Initialize

Create an instance and start scanning with just a few lines of code.

function onScanSuccess(decodedText, decodedResult) {
  // Handle on success condition with the decoded text or result.
  console.log(`Scan result: ${decodedText}`, decodedResult);
}

const html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess);

[4] Optional - Stop scanning after the code is scanned?

You can use Html5QrcodeScanner#clear() method to stop scanning after the code is scanned.

const html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: 250 });
        
function onScanSuccess(decodedText, decodedResult) {
  console.log(`Scan result: ${decodedText}`, decodedResult);
  html5QrcodeScanner.clear();
  // ^ this will stop the scanner (video feed) and clear the scan area.
}

html5QrcodeScanner.render(onScanSuccess);

[5] Optional - Handle scan failure?

You can handle scan failure or video failure using a failure callback.

function onScanSuccess(decodedText, decodedResult) {
  console.log(`Scan result: ${decodedText}`, decodedResult);
}

function onScanError(errorMessage) {
  // handle on error condition, with error message
}

const html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: 250 });
html5QrcodeScanner.render(onScanSuccess, onScanError);

[6] More configurations

The library supports various configurations to customize the behavior. Visit the GitHub documentation for a full list.
Configuration 	Description
fps 	Integer, Example = 10
Frames per second. Default is 2. Increase for faster scanning, but avoid excessively high values which may impact performance.
qrbox 	Integer, Example = 250
Limit the region of the viewfinder used for scanning. The rest of the viewfinder will be shaded.
aspectRatio 	Float, Example 1.77 for 16:9
Render the video feed in a specific aspect ratio. If omitted, the whole viewfinder is used.
disableFlip 	Boolean, default = false
By default, the scanner can scan horizontally flipped codes (common for front cameras). Change this if you are sure the feed won't be mirrored.
formatsToSupport 	Html5QrcodeSupportedFormats
Configure to only support a specific subset of code formats. See documentation for details.
Frequently Asked Questions
Is this supported on smartphones?

Yes! The solution is based on vanilla HTML5 and JavaScript. It works on any HTML5 supported browser, including modern iOS and Android browsers.
Full example on how to use this?

Check the source code of this page or checkout this gist where the JS code is copied.
I copied the demo code but it's not working?

Few identified reasons so far:

    Camera access only works for https and not http (except for localhost or local server).
    You cannot test this by opening the HTML file directly; it must be served by a web server. See this guide for local testing.

Where can I read more?

Apart from the documentation on the GitHub project, the following articles are very helpful for advanced integration:

    QR and barcode scanner using HTML and Javascript
    Support for local file scanning and default camera (v1.0.5)
