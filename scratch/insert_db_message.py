import psycopg2
import time

try:
    conn = psycopg2.connect(
        host="db.ufihkyhvvqfusgavndmh.supabase.co",
        port=5432,
        user="postgres",
        password="VihtAdmin2026",
        database="postgres"
    )
    cur = conn.cursor()
    print("Connected to database.")

    # Insert message
    cur.execute("""
        INSERT INTO public.messages (conversation_id, sender_id, content)
        VALUES ('2cce8410-55fa-41c4-a62b-58059fba096a', 'ba633e22-aa73-4b66-870b-e4dda50407e2', 'REALTIME_TEST_MESSAGE_FROM_VPS')
        RETURNING id
    """)
    row = cur.fetchone()
    msg_id = row[0]
    conn.commit()
    print("Inserted message ID:", msg_id)

    # Wait 8 seconds
    print("Waiting 8 seconds...")
    time.sleep(8)

    # Delete message
    cur.execute("DELETE FROM public.messages WHERE id = %s", (msg_id,))
    conn.commit()
    print("Deleted message.")

    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
