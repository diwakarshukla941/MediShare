import PQueue from "p-queue";

// Bounds how many ffmpeg burns can run at the same time. This does NOT
// reduce how much memory a single burn needs — a video that's too big for
// the container on its own will still fail when its turn comes up. What it
// does prevent is several burns stacking their memory together: on a small
// instance, two or three people downloading around the same moment, each
// spawning their own ffmpeg process, is a fast way to exceed a memory
// limit that any one of them alone would have stayed under. concurrency: 1
// is deliberately conservative — worth raising later once real per-job
// memory usage is known (e.g. after moving to a bigger instance), but
// wrong to guess at now.
const queue = new PQueue({ concurrency: 1 });

export function enqueueBurn(task) {
  return queue.add(task);
}
