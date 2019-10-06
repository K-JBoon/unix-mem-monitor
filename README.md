# unix-mem-monitor

NPM package to monitor memory usage on Unix systems without ps, specifically made for AWS Lambda

For an example of using this on Lambda see the following SAM project: [https://github.com/K-JBoon/lambda-mem-monitor](https://github.com/K-JBoon/lambda-mem-monitor)

## Usage

```js
const MemMonitor = require('unix-mem-monitor');

...

// Instantiate a new MemMonitor and configure
const memMonitor = new MemMonitor({
    PID: process.pid, // Static PID to monitor, at least one of PID or PIDs must be specified
    PIDs: [ 1, 2, 3, 4, 5, 6 ], // Static PIDs to monitor, at least one of PID or PIDs must be specified
    monitorChildProcesses: true, // Optional configuration which makes MemMonitor automatically add all child processes of process.pid to the PIDs to monitor
    pollrate: 500 // Optional configuration to adjust the pollrate of MemMonitor, defaults to 1000ms
});

// Let MemMonitor initialize, during initialization the system's pagesize is acquired and monitoring jobs are started
await memMonitor.init();

/* MemMonitor emits a data event which contains statm data for all PIDs that are to be monitored
Structured as:

{
    PID1: {
            size:       [size in MB], // total program size
            resident:   [size in MB], // resident set size
            share:      [size in MB], // number of resident shared pages
            text:       [size in MB], // text (code)
            lib:        [size in MB], // library (unused since Linux 2.6; always 0)
            data:       [size in MB], // data + stack
            dt:         [size in MB]  // dirty pages (unused since Linux 2.6; always 0)
    },
    PID2: {
            size:       [size in MB], // total program size
            resident:   [size in MB], // resident set size
            share:      [size in MB], // number of resident shared pages
            text:       [size in MB], // text (code)
            lib:        [size in MB], // library (unused since Linux 2.6; always 0)
            data:       [size in MB], // data + stack
            dt:         [size in MB]  // dirty pages (unused since Linux 2.6; always 0)
    },
    ...
}
*/
memMonitor.on('data', data => {
    console.log(data);
});

// You can forcibly start the pull of new memory data with
memMonitor.updateMemoryData(); // Note: async!

// You can forcible start the updating of child processes with
memMonitor.updateChildProcesses(); // Note: async

// You can get current memory data at any time with
const currentMemoryData = memMonitor.memoryData;

/* You can get a reduced version (combined numbers of all processes) with MemMonitor.getMergedMemoryData()
Structured as:

{
    size:       [size in MB], // total program size
    resident:   [size in MB], // resident set size
    share:      [size in MB], // number of resident shared pages
    text:       [size in MB], // text (code)
    lib:        [size in MB], // library (unused since Linux 2.6; always 0)
    data:       [size in MB], // data + stack
    dt:         [size in MB]  // dirty pages (unused since Linux 2.6; always 0)
}
*/
const reducedMemoryData = memMonitor.getMergedMemoryData();

// You can unsubscribe all listeners and stop the polling process with
memMonitor.kill();
```