import psycopg2

try:
    conn = psycopg2.connect(
        host="db.ufihkyhvvqfusgavndmh.supabase.co",
        port=5432,
        user="postgres",
        password="VihtAdmin2026",
        database="postgres"
    )
    cur = conn.cursor()
    print("Connected to database directly via IPv6 successfully!")

    # 1. Check supabase_realtime publication
    cur.execute("""
        SELECT schemaname, tablename 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime'
    """)
    print("\n--- Tables in supabase_realtime publication ---")
    rows = cur.fetchall()
    for row in rows:
        print(f"{row[0]}.{row[1]}")

    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
