package component.task

import org.openforis.sepal.component.task.api.WorkerSession
import org.openforis.sepal.component.task.api.WorkerSessionManager

import static org.openforis.sepal.component.task.api.WorkerSession.State.PENDING

class FakeWorkerSessionManager implements WorkerSessionManager {
    private final Map<String, WorkerSession> sessionById = [:]
    private final List<WorkerSession> closedSessions = []
    private final List<Closure> sessionActivatedListeners = []
    private final List<Closure> sessionClosedListeners = []
    private final List<String> heartbeats = []

    WorkerSession requestSession(String username, String instanceType) {
        def session = new WorkerSession(
                id: uuid(),
                instanceType: instanceType,
                username: username,
                host: UUID.randomUUID().toString(),
                state: PENDING)
        sessionById[session.id] = session
        return session
    }

    WorkerSession findPendingOrActiveSession(String username, String instanceType) {
        allSessions()
                .findAll { it.state != WorkerSession.State.CLOSED }
                .findAll { it.instanceType == instanceType }
                .find { it.username == username }
    }

    WorkerSession findSessionById(String sessionId) {
        sessionById[sessionId]
    }

    void closeSession(String sessionId) {
        closedSessions << sessionById.remove(sessionId)
    }

    void heartbeat(String sessionId) {
        heartbeats << sessionId
    }

    FakeWorkerSessionManager onSessionActivated(Closure listener) {
        sessionActivatedListeners << listener
        return this
    }

    FakeWorkerSessionManager onSessionClosed(Closure listener) {
        sessionClosedListeners << listener
        return this
    }

    String getDefaultInstanceType() {
        return 'some-instance-type'
    }

    WorkerSession activate(String sessionId) {
        def session = sessionById[sessionId]
        sessionById[sessionId] = session.activate()
        sessionActivatedListeners*.call(session)
    }

    WorkerSession close(String sessionId) {
        def session = sessionById[sessionId]
        sessionById[sessionId] = session.close()
        sessionActivatedListeners*.call(session)
    }

    WorkerSession requestedOne() {
        assert allSessions().size() == 1,
                "Expected one requested session. Actually requested ${allSessions().size()}: ${allSessions()}"
        return allSessions().first()
    }

    List<WorkerSession> requestedTwo() {
        assert allSessions().size() == 2,
                "Expected two requested session. Actually requested ${allSessions().size()}: ${allSessions()}"
        return allSessions()
    }

    void closedNone() {
        assert closedSessions.empty,
                "Expected no closed session. Actually closed ${closedSessions.size()}: ${closedSessions}"
    }

    WorkerSession closedOne() {
        assert closedSessions.size() == 1,
                "Expected one closed session. Actually closed ${closedSessions.size()}: ${closedSessions}"
        return closedSessions.first()
    }

    List<WorkerSession> closedTwo() {
        assert closedSessions.size() == 2,
                "Expected two closed session. Actually closed ${closedSessions.size()}: ${closedSessions}"
        return closedSessions
    }

    void receivedOneHeartbeat() {
        assert heartbeats.size() == 1,
                "Expected one heartbeat. Actually received ${heartbeats.size()}: ${heartbeats}"
    }

    void receivedNoHeartbeats() {
        assert heartbeats.empty,
                "Expected no heartbeat. Actually received ${heartbeats.size()}: ${heartbeats}"
    }

    private List<WorkerSession> allSessions() {
        sessionById.values().toList()
    }

    private String uuid() {
        UUID.randomUUID().toString()
    }
}
