# JEE OS (Vercel + Neon + Gemini)

## Setup (10 min)
1. **Neon:** neon.tech pe free project banao, Connection string copy karo (`postgresql://...`).
2. **Gemini key (free):** aistudio.google.com/apikey se key banao.
3. **GitHub:** ye folder ek repo me push karo (ya `vercel` CLI se deploy).
4. **Vercel:** New Project, repo import karo. Framework: **Other**. Settings > Environment Variables me `.env.example` ke variables daalo:
   - `DATABASE_URL`, `JWT_SECRET` (koi lamba random text), `GEMINI_API_KEY`
   - `PW_API_BASE` (apni API ka base link). Khali rakhoge toh batch search band rahega, baaki app chalega.
5. Deploy dabao. Tables app khud bana leta hai (`schema.sql` optional).

## Files
- `public/index.html`: poora app (frontend)
- `api/auth.js`: register/login (bcrypt + JWT)
- `api/data.js`: har user ka state aur chats DB me
- `api/ai.js`: Gemini proxy (key server pe secret rehti hai)
- `api/pw.js`: batch search aur batch import (PW_API_BASE se)
- `api/_lib.js`: DB aur auth helpers
