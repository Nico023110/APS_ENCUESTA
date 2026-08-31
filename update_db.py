from database import engine
from sqlalchemy import text
with engine.connect() as con:
    try:
        con.execute(text("UPDATE actividad SET informativo = TRUE WHERE nombre LIKE '%sellantes%'"))
        con.commit()
        print('Actividades de sellantes marcadas como informativas')
    except Exception as e:
        print('Error:', e)
