import pytest
import pandas as pd
import io
from comparador import normalizar_clave, normalizar_nit, comparar_facturas

def test_normalizar_clave():
    assert normalizar_clave("BOG", "16856") == "BOG16856"
    assert normalizar_clave("FEMQ", "00004465") == "FEMQ4465"
    assert normalizar_clave("", "FEMQ-00004465") == "FEMQ4465"
    assert normalizar_clave("A-B", "001") == "AB1"
    assert normalizar_clave(None, "123") == "123"
    assert normalizar_clave(" PRE ", " 001 ") == "PRE1"

def test_normalizar_nit():
    assert normalizar_nit("900123456-7") == "900123456"
    assert normalizar_nit("900.123.456-7") == "900123456"
    assert normalizar_nit("900123456") == "900123456"
    assert normalizar_nit(" 900 123 456 - 7 ") == "900123456"
    assert normalizar_nit(None) == ""

def create_excel_bytes(df):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    return output.getvalue()

def test_comparar_facturas():
    # Crear datos simulados DIAN
    df_dian = pd.DataFrame({
        "Folio": ["100", "200", "300"],
        "Prefijo": ["A", "B", "C"],
        "NIT Emisor": ["900111222-1", "800333444", "700555666-3"],
        "Nombre Emisor": ["Prov A", "Prov B", "Prov C"],
        "Fecha Emisión": ["2023-01-01", "2023-01-02", "2023-01-03"],
        "Grupo": ["Recibido", "Recibido", "Recibido"],
        "Tipo de documento": ["Factura electrónica", "Factura electrónica", "Factura electrónica"]
    })
    
    # Crear datos simulados Siesa
    df_siesa = pd.DataFrame({
        "Proveedor": ["900111222", "700555666", "800333444"], # Prov A, C, B
        "Docto. proveedor": ["A-100", "C-301", "B-200"],       # C-301 no coincide (era 300)
        "Razón social proveedor": ["Prov A", "Prov C", "Prov B"]
    })
    
    dian_bytes = create_excel_bytes(df_dian)
    siesa_bytes = create_excel_bytes(df_siesa)
    
    resultado = comparar_facturas(dian_bytes, siesa_bytes)
    
    resumen = resultado["resumen_general"]
    assert resumen["total_proveedores"] == 3
    assert resumen["total_dian"] == 3
    assert resumen["total_en_siesa"] == 2
    assert resumen["total_faltantes"] == 1
    assert resumen["total_extras"] == 1
    assert resumen["porcentaje_completitud"] == round((2 / 3) * 100, 1)
    
    proveedores = {p["nit"]: p for p in resultado["proveedores"]}
    # Prov A debe estar ok
    assert len(proveedores["900111222"]["faltantes"]) == 0
    assert len(proveedores["900111222"]["extras"]) == 0
    # Prov B debe estar ok
    assert len(proveedores["800333444"]["faltantes"]) == 0
    assert len(proveedores["800333444"]["extras"]) == 0
    # Prov C debe tener 1 faltante (C-300) y 1 extra (C-301)
    assert len(proveedores["700555666"]["faltantes"]) == 1
    assert proveedores["700555666"]["faltantes"][0]["factura"] == "C-300"
    assert len(proveedores["700555666"]["extras"]) == 1
    assert proveedores["700555666"]["extras"][0] == "C-301"
