import StepQueue from "./StepQueue";

export default class PlaybackScheduler {
  denominator;
  wholeNoteLength;
  stepQueue = new StepQueue();
  stepQueueIndex = 0;
  scheduledTicks = new Set();

  currentTick = 0;
  currentTickTimestamp = 0;

  _audioContextStartTime = 0;

  _schedulerInterval = null;
  _scheduleInterval = 200; // Milliseconds
  _schedulePeriod = 1500;
  _tickDenominator = 1024;

  _lastTickOffset = 300; // Hack to get the initial notes play better

  playing = false;

  _loaderFutureTicks = new Set();

  constructor(
    denominator,
    wholeNoteLength,
    audioContext,
    noteSchedulingCallback,
    iterationCallback
  ) {
    this.noteSchedulingCallback = noteSchedulingCallback;
    this.iterationCallback = iterationCallback;
    this.denominator = denominator;
    this.wholeNoteLength = wholeNoteLength;
    this.audioContext = audioContext;
  }

  get schedulePeriodTicks() {
    return this._schedulePeriod / this.tickDuration;
  }

  get audioContextTime() {
    if (!this.audioContext) return 0;
    return (this.audioContext.currentTime - this._audioContextStartTime) * 1000;
  }

  get _calculatedTick() {
    return (
      this.currentTick +
      Math.round(
        (this.audioContextTime - this.currentTickTimestamp) / this.tickDuration
      )
    );
  }

  get tickDuration() {
    return this.wholeNoteLength / this._tickDenominator;
  }

  start() {
    this.playing = true;
    this.stepQueue.sort();
    console.log("AudioContext time: ", this.audioContextTime);
    console.log("Tick duration: ", this.tickDuration);
    this._audioContextStartTime = this.audioContext.currentTime;
    this.currentTickTimestamp = this.audioContextTime;
    if (!this._schedulerInterval) {
      this._schedulerInterval = setInterval(
        () => this._scheduleIterationStep(),
        this._scheduleInterval
      );
    }
  }

  setIterationStep(step) {
    step = Math.min(this.stepQueue.steps.length - 1, step);
    this.stepQueueIndex = step;
    this.currentTick = this.stepQueue.steps[this.stepQueueIndex].tick;
  }

  pause() {
    this.playing = false;
  }

  resume() {
    this.playing = true;
    this.currentTickTimestamp = this.audioContextTime;
  }

  reset() {
    this.playing = false;
    this.currentTick = 0;
    this.currentTickTimestamp = 0;
    this.stepQueueIndex = 0;
    clearInterval(this._scheduleInterval);
    this._schedulerInterval = null;
  }

  loadNotes(currentVoiceEntries) {
    let thisTick = this._lastTickOffset;
    if (this.stepQueue.steps.length > 0) {
      thisTick = Math.min(...this._loaderFutureTicks);
    }

    for (let entry of currentVoiceEntries) {
      for (let note of entry.notes) {
        this._loaderFutureTicks.add(
          thisTick + note.length.realValue * this._tickDenominator
        );
        let step = { tick: thisTick };
        this.stepQueue.add(step, note);
      }
    }

    for (let tick of this._loaderFutureTicks) {
      if (tick <= thisTick) this._loaderFutureTicks.delete(tick);
    }
  }

  _scheduleIterationStep() {
    if (!this.playing) return;
    this.currentTick = this._calculatedTick;
    this.currentTickTimestamp = this.audioContextTime;

    let nextTick = this.stepQueue.steps[this.stepQueueIndex]
      ? this.stepQueue.steps[this.stepQueueIndex].tick
      : undefined;
    while (
      nextTick &&
      this.currentTickTimestamp +
        (nextTick - this.currentTick) * this.tickDuration <=
        this.currentTickTimestamp + this._schedulePeriod
    ) {
      let step = this.stepQueue.steps[this.stepQueueIndex];

      let timeToTick = (step.tick - this.currentTick) * this.tickDuration;
      if (timeToTick < 0) timeToTick = 0;

      this.scheduledTicks.add(step.tick);
      this.noteSchedulingCallback(timeToTick / 1000, step.notes);

      this.stepQueueIndex++;
      nextTick = this.stepQueue.steps[this.stepQueueIndex]
        ? this.stepQueue.steps[this.stepQueueIndex].tick
        : undefined;
    }

    for (let tick of this.scheduledTicks) {
      if (tick <= this.currentTick) {
        this.scheduledTicks.delete(tick);
      }
    }
  }
}
