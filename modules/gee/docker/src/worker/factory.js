const {Subject, ReplaySubject} = require('rxjs')
const {finalize, takeUntil, switchMap, filter, first, map} = require('rxjs/operators')
const {Worker, MessageChannel} = require('worker_threads')
const {deserializeError} = require('serialize-error')
const {v4: uuid} = require('uuid')
const path = require('path')
const _ = require('lodash')
const log = require('@sepal/log')

const WORKER_PATH = path.join(__dirname, 'worker.js')

const createWorker = () =>
    new Worker(WORKER_PATH)

const createChannels = names =>
    _.transform(names, (data, name) => {
        const {port1: localPort, port2: remotePort} = new MessageChannel()
        data.localPorts[name] = localPort
        data.remotePorts[name] = remotePort
    }, {
        localPorts: {},
        remotePorts: {}
    })

const bootstrapWorker$ = (name, channelNames) => {
    const worker$ = new Subject()
    const worker = createWorker()
    const {localPorts, remotePorts} = createChannels(channelNames)
    worker.once('message', status => {
        if (status === 'READY') {
            worker$.next({worker, ports: localPorts})
        } else {
            worker$.error('Cannot initialize worker.')
        }
    })
    worker.postMessage({name, ports: remotePorts}, _.values(remotePorts))
    return worker$.pipe(
        first()
    )
}

const initWorker$ = (name, jobPath) => {
    const init$ = new ReplaySubject()
    const dispose$ = new Subject()

    const msg = msg =>
        `Worker <${name}> ${msg}`

    const submit$ = args => {
        const result$ = new Subject()

        const run$ = port => {
            const jobId = uuid()

            const open = () =>
                port.on('message', handleWorkerMessage)

            const send = msg =>
                port.postMessage(msg)

            const close = () =>
                port.off('message', handleWorkerMessage)

            const handleWorkerMessage = message =>
                message.jobId === jobId
                    ? handleValidWorkerMessage(message)
                    : handleInvalidWorkerMessage(message)
        
            const handleValidWorkerMessage = message => {
                message.value && handleValue(message.value)
                message.error && handleError(message.error)
                message.complete && handleComplete(message.complete)
            }
            
            const handleInvalidWorkerMessage = message =>
                log.warn(msg(`sent msg with non-matching jobId (expected <${jobId.substr(-4)}>):`), message)

            const handleValue = value => {
                log.trace(msg(`job <${jobId.substr(-4)}> emitted value: ${value}`))
                result$.next({value})
            }
    
            const handleError = serializedError => {
                const error = deserializeError(serializedError)
                const errors = _.compact([
                    error.message,
                    error.type ? `(${error.type})` : null
                ]).join()
                log.error(msg(`job <${jobId.substr(-4)}> error: ${errors}`))
                result$.next({error})
                close()
            }
    
            const handleComplete = () => {
                log.debug(msg(`job <${jobId.substr(-4)}> completed`))
                result$.complete()
                close()
            }
    
            const start = jobId => {
                const workerArgs = _.last(args)
                _.isEmpty(workerArgs)
                    ? log.debug(msg('running with no args'))
                    : log.debug(msg('running with args:'), workerArgs)
                open()
                send({start: {jobId, jobPath, args}})
            }
    
            const stop = jobId =>
                send({stop: {jobId}})
    
            start(jobId)
            return result$.pipe(
                finalize(() => stop(jobId))
            )
        }

        return init$.pipe(
            switchMap(port => run$(port))
        )
    }

    // bootstrapWorker$(jobName, ['job', 'rateLimit'])
    return bootstrapWorker$(name, ['job']).pipe(
        map(
            // ({worker, ports: {job: jobPort, rateLimitPort}}) => {
            ({worker, ports: {job: jobPort}}) => {
                init$.next(jobPort)
                // const subscription = rateLimiter(rateLimitPort)
                // jobPort.on('message', handleWorkerMessage)

                dispose$.pipe(
                    first()
                ).subscribe(
                    () => {
                        worker.unref() // is this correct? terminate() probably isn't...
                        // subscription.cleanup()
                        log.info(msg('disposed'))
                    }
                )
                log.trace('Worker ready')

                return {submit$, dispose$}
            }
        ))
}

module.exports = {
    initWorker$
}
