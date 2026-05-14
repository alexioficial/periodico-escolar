<script lang="ts">
	type Props = {
		open: boolean;
		file: File | null;
		onConfirm: (file: File) => void;
		onCancel: () => void;
	};

	let { open = $bindable(), file, onConfirm, onCancel }: Props = $props();

	const CROP_SIZE = 288;
	const OUTPUT_SIZE = 512;

	let imgEl = $state<HTMLImageElement | undefined>();
	let imgUrl = $state<string | null>(null);
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);
	let minScale = $state(1);
	let maxScale = $state(4);
	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let isProcessing = $state(false);

	const activePointers = new Map<number, { x: number; y: number }>();
	let dragStartOffsetX = 0;
	let dragStartOffsetY = 0;
	let pinchStartDistance = 0;
	let pinchStartScale = 1;

	$effect(() => {
		if (!file) {
			imgUrl = null;
			return;
		}
		const url = URL.createObjectURL(file);
		imgUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	$effect(() => {
		if (!open) {
			activePointers.clear();
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onCancel();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function onImgLoad() {
		if (!imgEl) return;
		naturalWidth = imgEl.naturalWidth;
		naturalHeight = imgEl.naturalHeight;
		const minS = Math.max(CROP_SIZE / naturalWidth, CROP_SIZE / naturalHeight);
		minScale = minS;
		maxScale = Math.max(minS * 4, minS + 0.1);
		scale = minS;
		offsetX = 0;
		offsetY = 0;
	}

	function clampOffsets() {
		const halfImgW = (naturalWidth * scale) / 2;
		const halfImgH = (naturalHeight * scale) / 2;
		const halfCrop = CROP_SIZE / 2;
		const maxOffX = Math.max(0, halfImgW - halfCrop);
		const maxOffY = Math.max(0, halfImgH - halfCrop);
		offsetX = Math.max(-maxOffX, Math.min(maxOffX, offsetX));
		offsetY = Math.max(-maxOffY, Math.min(maxOffY, offsetY));
	}

	function getPinchDistance() {
		const pts = Array.from(activePointers.values());
		if (pts.length < 2) return 0;
		const dx = pts[0].x - pts[1].x;
		const dy = pts[0].y - pts[1].y;
		return Math.hypot(dx, dy);
	}

	function onPointerDown(e: PointerEvent) {
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		if (activePointers.size === 1) {
			const pt = activePointers.get(e.pointerId)!;
			dragStartOffsetX = offsetX - pt.x;
			dragStartOffsetY = offsetY - pt.y;
		} else if (activePointers.size === 2) {
			pinchStartDistance = getPinchDistance();
			pinchStartScale = scale;
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!activePointers.has(e.pointerId)) return;
		activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (activePointers.size === 1) {
			offsetX = dragStartOffsetX + e.clientX;
			offsetY = dragStartOffsetY + e.clientY;
			clampOffsets();
		} else if (activePointers.size === 2 && pinchStartDistance > 0) {
			const dist = getPinchDistance();
			const factor = dist / pinchStartDistance;
			scale = Math.max(minScale, Math.min(maxScale, pinchStartScale * factor));
			clampOffsets();
		}
	}

	function onPointerUp(e: PointerEvent) {
		activePointers.delete(e.pointerId);
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignorado */
		}
		if (activePointers.size === 1) {
			const remaining = Array.from(activePointers.values())[0];
			dragStartOffsetX = offsetX - remaining.x;
			dragStartOffsetY = offsetY - remaining.y;
		}
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = -e.deltaY * 0.0015;
		scale = Math.max(minScale, Math.min(maxScale, scale + delta * scale));
		clampOffsets();
	}

	function onScaleInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		scale = Number(target.value);
		clampOffsets();
	}

	async function confirm() {
		if (!imgEl || !file || isProcessing) return;
		isProcessing = true;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = OUTPUT_SIZE;
			canvas.height = OUTPUT_SIZE;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const sourceSize = CROP_SIZE / scale;
			const sourceCenterX = naturalWidth / 2 - offsetX / scale;
			const sourceCenterY = naturalHeight / 2 - offsetY / scale;
			const sourceX = sourceCenterX - sourceSize / 2;
			const sourceY = sourceCenterY - sourceSize / 2;

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(
				imgEl,
				sourceX,
				sourceY,
				sourceSize,
				sourceSize,
				0,
				0,
				OUTPUT_SIZE,
				OUTPUT_SIZE
			);

			const isPng = file.type === 'image/png';
			const mime = isPng ? 'image/png' : 'image/jpeg';
			const ext = isPng ? 'png' : 'jpg';
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, mime, 0.92)
			);
			if (!blob) return;

			const cropped = new File([blob], `avatar.${ext}`, { type: mime });
			onConfirm(cropped);
		} finally {
			isProcessing = false;
		}
	}
</script>

{#if open && imgUrl}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Ajustar foto de perfil"
	>
		<div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
			<header class="border-b border-slate-200 px-5 py-3">
				<h2 class="text-base font-semibold text-slate-900">Ajustar foto de perfil</h2>
				<p class="text-xs text-slate-500">
					Arrastrá para mover y usá el control de zoom para encuadrar.
				</p>
			</header>

			<div class="flex flex-col items-center gap-4 px-5 py-5">
				<div
					class="relative touch-none overflow-hidden rounded-lg bg-slate-950 select-none"
					style:width="{CROP_SIZE}px"
					style:height="{CROP_SIZE}px"
					onpointerdown={onPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
					onwheel={onWheel}
					role="application"
					aria-label="Área de recorte"
				>
					<img
						bind:this={imgEl}
						src={imgUrl}
						alt=""
						onload={onImgLoad}
						draggable="false"
						class="pointer-events-none absolute top-1/2 left-1/2 max-w-none origin-center"
						style:width="{naturalWidth * scale}px"
						style:height="{naturalHeight * scale}px"
						style:transform="translate({offsetX - (naturalWidth * scale) / 2}px, {offsetY -
							(naturalHeight * scale) / 2}px)"
					/>

					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox="0 0 {CROP_SIZE} {CROP_SIZE}"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<path
							d={`M0,0 H${CROP_SIZE} V${CROP_SIZE} H0 Z M${CROP_SIZE / 2 - (CROP_SIZE / 2 - 6)},${CROP_SIZE / 2} a${CROP_SIZE / 2 - 6},${CROP_SIZE / 2 - 6} 0 1,0 ${2 * (CROP_SIZE / 2 - 6)},0 a${CROP_SIZE / 2 - 6},${CROP_SIZE / 2 - 6} 0 1,0 ${-2 * (CROP_SIZE / 2 - 6)},0 Z`}
							fill="rgba(15,23,42,0.55)"
							fill-rule="evenodd"
						/>
						<circle
							cx={CROP_SIZE / 2}
							cy={CROP_SIZE / 2}
							r={CROP_SIZE / 2 - 6}
							fill="none"
							stroke="white"
							stroke-width="2"
							opacity="0.9"
						/>
					</svg>
				</div>

				<div class="flex w-full items-center gap-3">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-4 w-4 text-slate-500"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
						<line x1="8" y1="11" x2="14" y2="11" />
					</svg>
					<input
						type="range"
						min={minScale}
						max={maxScale}
						step="0.01"
						value={scale}
						oninput={onScaleInput}
						aria-label="Zoom"
						class="flex-1 accent-indigo-600"
					/>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-4 w-4 text-slate-500"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
						<line x1="8" y1="11" x2="14" y2="11" />
						<line x1="11" y1="8" x2="11" y2="14" />
					</svg>
				</div>
			</div>

			<footer class="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
				<button
					type="button"
					onclick={onCancel}
					disabled={isProcessing}
					class="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={confirm}
					disabled={isProcessing || !imgEl}
					class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
				>
					{#if isProcessing}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="h-4 w-4 animate-spin"
							aria-hidden="true"
						>
							<path d="M21 12a9 9 0 1 1-6.219-8.56" />
						</svg>
						Procesando...
					{:else}
						Aplicar
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}
