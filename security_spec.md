# Firebase Security Specification (TDD)
This specification outlines the data invariants and security test conditions for the Exambro CBT platform's Firestore database rules.

## 1. Data Invariants
1. **Unauthenticated Writes Blocked**: All collections except student live sessions (`/sessions`) and exam submissions (`/hasilUjian`) strictly require authenticated administrator/proctor/teacher credentials.
2. **Read Access allowed for Exambro Client**: Essential data such as class structural settings (`/kelas`), subjects (`/mapel`), student verification (`/siswa`), and exams (`/jadwalUjian`) must remain readable by client devices (and Exambro browser engines) to facilitate independent authentication and offline-handling sync, but structured and locked down for writes.
3. **Write Isolation**: Student accounts cannot modify core schedules (`/jadwalUjian`), token strings (`/tokenUjian`), questions (`/soal`), or school parameters (`/konfigurasi/sekolah`).
4. **Session Autonomy**: Live tracker records in `/sessions` can be created and mutated dynamically by student client engines to update tracking logs, but deletions are restricted to authorized proctors.

## 2. Security Spec - High-Security Rules Map
All matching rules are formatted to adhere to Phase 4 (Hardened Fortress Rules) within `/firestore.rules`.
