# POCHO LAB v0.2.1

- Fixed a runtime crash in condition evaluation: two clauses incorrectly read `q.velocity.y`, but `q` is Pocho metadata, not a Matter.js Body.
- Both clauses now correctly read `other.velocity.y`.
- Searched the simulator source for the same metadata/body mix-up; no other `q.velocity`, `q.position`, `q.mass`, or `q.speed` references remain.
