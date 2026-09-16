export function sessionIsAllowed(session: { qaAuthVersion?: string }): boolean {
	return session.qaAuthVersion === undefined;
}
