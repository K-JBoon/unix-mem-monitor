const { DEFAULT_PAGESIZE } = require('./constants');
const exec = require('util').promisify(require('child_process').exec);

/**
 * Executes a command in the shell, and returns the stdout and stderr stream outputs as a string
 * @param {String} cmd command to execute in the shell 
 */
const execStr = async (cmd) => {
    try {
        const { stdout, stderr } = await exec(cmd);

        return { stdout: stdout.toString(), stderr: stderr.toString() };
    } catch (e) {
        return { stdout: null, stderr: null };
    }
};

/**
 * Returns the page size of the system, or the default fallback if it couldn't be fetched
 */
const getPageSize = async () => {
    const { stdout } = await execStr('getconf PAGE_SIZE');

    if (stdout) {
        const pageSizeAsInt = parseInt(stdout);

        if (!isNaN(pageSizeAsInt)) {
            return pageSizeAsInt;
        } else {
            return DEFAULT_PAGESIZE;
        }
    } else {
        return DEFAULT_PAGESIZE;
    }
};

/**
 * Returns all (user) processes currently running on the system
 */
const listPIDs = async () => {
    const { stdout } = await execStr(`ls /proc/ -1`);

    if (stdout) {        
        return stdout.split('\n').filter((PID) => !isNaN(PID));
    }

    return;
}

/**
 * Returns all child processes belonging to PPID
 * @param {number} PPID 
 */
const getChildProcesses = async (PPID) => {
    PPID = PPID || process.pid;
    const PIDs = await listPIDs();

    if (PIDs) {
        const childProcesses = [];

        for (const PID of PIDs) {
            const { stdout } = await execStr(`cat /proc/${PID}/status | grep PPid`);

            if (stdout) {
                const ppid = stdout.match(/(\d+)/);

                if (ppid && ppid.length === 2 && parseInt(ppid[1]) === PPID) {
                    childProcesses.push(PID);
                }
            }
        }

        return childProcesses;
    }

    return [];
};

/**
 * Returns the contents of a /proc file for the specified PID
 * @param {Number} PID 
 * @param {String} file 
 */
const getProcessFile = async (PID, file) => {
    const { stdout } = await execStr(`cat /proc/${PID}/${file}`);

    if (stdout) {
        return stdout;
    }

    return;
}

/**
 * Returns a formatted statm object, giving information about the memory usage in MB
 * @param {Number} PID 
 * @param {Number} pageSize 
 */
const getPIDstatm = async (PID, pageSize) => {
    const statmContents = await getProcessFile(PID, 'statm');

    if (statmContents) {
        const statmToMb = statmContents.split(' ').map((segment) => {
            segment = parseInt(segment);
            segment *= pageSize; // statm is expressed in pagesize
            segment /= (1024 ** 2) // pagesize is expressed in bytes, convert to MB

            return segment;
        });

        const statm = {
            size:       statmToMb[0], // total program size
            resident:   statmToMb[1], // resident set size
            share:      statmToMb[2], // number of resident shared pages
            text:       statmToMb[3], // text (code)
            lib:        statmToMb[4], // library (unused since Linux 2.6; always 0)
            data:       statmToMb[5], // data + stack
            dt:         statmToMb[6]  // dirty pages (unused since Linux 2.6; always 0)
        };

        return statm;
    }

    return;
}

module.exports = {
    execStr,
    getPageSize,
    getChildProcesses,
    getProcessFile,
    getPIDstatm
}