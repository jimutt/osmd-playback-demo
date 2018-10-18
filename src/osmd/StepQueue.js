export default class StepQueue {
  steps = [];

  constructor() {}

  [Symbol.iterator]() {
    return this.steps.values();
  }

  add(stepObject, note) {
    let existingStep = this.steps.find(s => s.tick === stepObject.tick);
    if (existingStep) {
      stepObject = existingStep;
      stepObject.notes.push(note);
    } else {
      stepObject.notes = [note];
      this.steps.push(stepObject);
    }
  }

  delete(value) {
    let index = this.steps.findIndex(v => v.tick === value.tick);
    if (index != null) this.steps.splice(index, 1);
  }

  sort() {
    this.steps.sort((a, b) => (a.tick > b.tick ? 1 : 0));
  }
}
