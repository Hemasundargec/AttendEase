export class DuplicateUserError extends Error {
  constructor() { super('duplicate user'); this.name = 'DuplicateUserError' }
}
export class DuplicateSubjectError extends Error {
  constructor() { super('duplicate subject'); this.name = 'DuplicateSubjectError' }
}
