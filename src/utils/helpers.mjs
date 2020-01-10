export function getPrUrl(requestBody) {
    if (requestBody.pull_request != null) {
        return requestBody.pull_request.html_url
    } else if (requestBody.issue != null && requestBody.issue.pull_request != null) {
        return requestBody.issue.pull_request.html_url
    } else {
        return null
    }
}

export function getPrAction(githubEvent) {
    console.log('getPrAction called with', {headers: githubEvent.headers, body: githubEvent.body})
    const eventType = githubEvent.headers['X-GitHub-Event']
    const requestBody = githubEvent.body
    return Object.keys(actionConditions).find((key) => actionConditions[key](eventType, requestBody))
}

export const actionConditions = {
    commented: (eventType, requestBody) =>
        (eventType === 'issue_comment' && requestBody.action === 'created') ||
        (eventType === 'pull_request_review' &&
            requestBody.action === 'submitted' &&
            requestBody.review.state === 'commented'),
    approved: (eventType, requestBody) =>
        eventType === 'pull_request_review' &&
        requestBody.action === 'submitted' &&
        requestBody.review.state === 'approved',
    changes_requested: (eventType, requestBody) =>
        eventType === 'pull_request_review' &&
        requestBody.action === 'submitted' &&
        requestBody.review.state === 'changes_requested',
    merged: (eventType, requestBody) =>
        eventType === 'pull_request' && requestBody.action === 'closed' && requestBody.pull_request.merged,
}

export function getPrUrlsFromString(text) {
    return text.match(/(https:\/\/github\.com\/[\w-_]+\/[\w-_]+\/pull\/\d+)/g) || []
}
