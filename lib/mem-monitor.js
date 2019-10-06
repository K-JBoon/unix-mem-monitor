const EventEmitter = require('events');
const { getPageSize, getChildProcesses, getPIDstatm } = require('./util');
const { DEFAULT_POLLRATE } = require('./constants');

/**
 * Validates the given params for MemMonitor
 * @param {object} params 
 */
const validateParams = (params) => {
    if (typeof params !== 'object') {
        throw 'Argument must be of type object';
    }

    if (!params.PID && !params.PIDs) {
        throw 'Argument must have property PID or PIDs'
    }

    if (params.PID && typeof params.PID !== 'string' && typeof params.PID !== 'number') {
        throw 'PID must be a string or number';   
    }

    if (params.PIDs && !Array.isArray(params.PIDs)) {
        throw 'PIDs must be an array'
    }

    if (params.pollrate && typeof params.pollrate !== 'number') {
        throw 'pollrate must be a number';
    }
};

class MemMonitor extends EventEmitter {
    /**
     * Construct a new instance of MemMonitor
     * @param {object} params
     * @property {number|string} [params.PID] PID to monitor, at least one of PID or PIDs must be specified
     * @property {Array} [params.PIDs] PIDs to monitor, at least one of PID or PIDs must be specified
     * @property {number} [params.pollrate] How often MemMonitor should scan processes (in ms)
     * @property {boolean} [params.monitorChildProcesses] Whether MemMonitor should automatically monitor child processes or not
     */
    constructor(params) {
        super();

        validateParams(params);
        this.params = params;

        this.PIDs = (params.PIDs) ? params.PIDs : [];
        if (params.PID) this.PIDs.push(params.PID);

        this.intervals = []; // Holds the polling tasks that go over /proc to get info on memory
        this.childProcesses = []; // Holds the current list of child processes
        this.pollrate = (params.pollrate) ? params.pollrate : DEFAULT_POLLRATE; // How often MemMonitor should get new info from /proc

        this.memoryData = {};
    }

    /**
     * Sets up MemMonitor and starts polling data
     */
    async init () {
        this.pageSize = await getPageSize();

        if (this.params.monitorChildProcesses && this.params.monitorChildProcesses === true) {
            this.childProcesses = await getChildProcesses();

            this.intervals.push(setInterval(this.updateChildProcesses, this.pollrate, this));
        }

        this.intervals.push(setInterval(this.updateMemoryData, this.pollrate, this));
    }

    /**
     * Add new PIDs or a single PID for MemMonitor to watch
     * @param {Array|number|string} PIDsToAdd 
     */
    addPIDs (PIDsToAdd) {
        const PIDsToAddIsArray = Array.isArray(PIDsToAdd);
        if (PIDsToAddIsArray || typeof PIDsToAdd === 'string' || typeof PIDsToAdd === 'number') {
            if (PIDsToAddIsArray) this.PIDs.concat(PIDsToAdd);
            if (!PIDsToAddIsArray) {
                const PIDasInt = parseInt(PIDsToAdd);

                if (!isNaN(PIDasInt)) {
                    this.PIDs.push(PIDasInt);
                }
            }
        } else {
            throw "Argument must be of type array, string or number"
        }
    }

    /**
     * Go over the PIDs set to be monitored and get their memory info
     */
    async updateMemoryData(_this) {
        _this = _this || this;

        const newMemoryData = {};

        for (const PID of _this.getPIDsToMonitor()) {
            newMemoryData[PID] = await getPIDstatm(PID, _this.pageSize);
        }

        _this.memoryData = newMemoryData;

        _this.emit('data', _this.memoryData);
    }

    /**
     * Check which child processes exist for this process
     */
    async updateChildProcesses(_this) {
        _this = _this || this;
        _this.childProcesses = await getChildProcesses();
    }

    /**
     * Generate a reduced version of the memory data
     */
    getMergedMemoryData() {
        return Object.values(this.memoryData).reduce((previous, current) => {
            for (const property in current) {
                previous[property] += current[property];
            }
            return previous;
        });
    }

    /**
     * Get the PIDs to monitor
     */
    getPIDsToMonitor() {
        return this.PIDs.concat(this.childProcesses).filter((v, i, a) => a.indexOf(v) === i);
    }

    /**
     * Destroy MemMonitor
     */
    kill() {
        this.removeAllListeners();
        this.intervals.forEach((interval) => clearInterval(interval));
    }
}

module.exports = MemMonitor;