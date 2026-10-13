export const IS_DEMO = import.meta.env.MODE === 'demo'

export const DEMO_ACCOUNTS = [
  { label: 'administrateur', login: 'admin', password: 'demo1234', role: 'admin' },
  { label: 'binôme (tournée 2)', login: 'tournee2', password: 'demo1234', role: 'member' },
]
