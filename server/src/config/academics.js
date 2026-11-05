// Academic options offered at registration. Adding a college, regulation or branch later
// means adding an entry here (and, in a later milestone, managing it from the admin panel).
// NOTE: these are selection options only. We do NOT claim any subject list is official.
export const academics = {
  colleges: [{ id: 'SRGEC', name: 'Seshadri Rao Gudlavalleru Engineering College (SRGEC)' }],
  regulations: [{ id: 'R23', name: 'R23' }],
  // Placeholder branch list. Confirm and edit it to match the branches SRGEC actually offers.
  branches: [
    { id: 'CSE', name: 'Computer Science and Engineering' },
    { id: 'ECE', name: 'Electronics and Communication Engineering' },
    { id: 'EEE', name: 'Electrical and Electronics Engineering' },
    { id: 'ME', name: 'Mechanical Engineering' },
    { id: 'CE', name: 'Civil Engineering' },
    { id: 'IT', name: 'Information Technology' },
  ],
  years: [1, 2, 3, 4],
}

// Year y covers semesters 2y-1 and 2y (year 2 -> semesters 3 and 4).
export const semestersForYear = (year) => [2 * year - 1, 2 * year]

export const hasId = (list, id) => list.some((item) => item.id === id)
