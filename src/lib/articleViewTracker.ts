export function trackArticleView(node: HTMLElement, id: string) {
	let sent = false;
	const observer = new IntersectionObserver(
		(entries) => {
			if (sent || !entries.some((entry) => entry.isIntersecting)) return;
			sent = true;
			observer.disconnect();
			void fetch(`/api/articles/${id}/view`, { method: 'POST', keepalive: true }).catch(() => {});
		},
		{ threshold: 0 }
	);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}
