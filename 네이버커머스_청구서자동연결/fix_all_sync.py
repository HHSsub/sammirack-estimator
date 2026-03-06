import sqlite3
import os
import sys
import datetime

# 1. Update API code to respect client updatedAt
api_file = "/home/rocky/sammirack-api/routes/documents.js"
print("1. Updating documents.js to respect updatedAt...")
if os.path.exists(api_file):
    with open(api_file, "r", encoding="utf-8") as f:
        content = f.read()

    # The `data.createdAt || now` logic exists, but updated_at is hardcoded to `now`
    #   data.createdAt || now,
    #   now,
    #   data.deleted ? 1 : 0,
    old_code = r"""      data.createdAt || now,
      now,
      data.deleted ? 1 : 0,"""
    new_code = r"""      data.createdAt || now,
      data.updatedAt || now,
      data.deleted ? 1 : 0,"""
    
    if old_code in content:
        content = content.replace(old_code, new_code)
        with open(api_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(" -> Successfully patched documents.js")
        print(" -> Restarting sammirack-api...")
        os.system("pm2 restart sammirack-api")
    else:
        print(" -> documents.js already patched or code not found.")
else:
    print(" -> FATAL: documents.js not found at " + api_file)
    sys.exit(1)


# 2. Fix Database SQLite Timestamps
db_file = "/home/rocky/db/sammi.db"
print("\n2. Fixing corrupted SQLite Timestamps...")
if os.path.exists(db_file):
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # We find any document that got mistakenly updated_at on March 6th
    # but was created BEFORE March 6th.
    query = "UPDATE documents SET updated_at = created_at WHERE created_at < '2026-03-06' AND updated_at LIKE '2026-03-06%';"
    
    cursor.execute(query)
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(" -> Successfully reverted {} documents back to their original created_at timestamps!".format(affected))
else:
    print(" -> FATAL: Database not found at " + db_file)
