"""
Sua Houses: receptor de registros de huéspedes y transmisión TRA.

Qué hace:
  1. Recibe el registro del formato de check-in (POST /api/checkin).
  2. Guarda cada registro en submissions.jsonl (respaldo local).
  3. Si el apartamento tiene token configurado, transmite la TRA a MinCIT:
     huésped principal -> https://pms.mincit.gov.co/one/
     cada acompañante  -> https://pms.mincit.gov.co/two/

Configuración (variables de entorno, nunca escribir tokens en el código):
  TRA_TOKEN_XIA_XUE, TRA_TOKEN_IECHIE, TRA_TOKEN_CENTRICO19
  RNT_XIA_XUE, RNT_IECHIE, RNT_CENTRICO19

Despliegue gratis sugerido: Render o Railway, igual que el backend de Bold.
  pip install -r requirements.txt
  TRA_TOKEN_XIA_XUE=... RNT_XIA_XUE=110692 python tra_server.py

Nota honesta: el manual de integración PMS de MinCIT describe los campos de
la TRA, pero la colocación exacta del token (encabezado o cuerpo) debe
confirmarse en la primera prueba en vivo. Por eso el token se envía en el
encabezado Authorization y también como campo "token" del cuerpo, y el
servidor registra los códigos de respuesta sin registrar jamás el token.
Una prueba en vivo crea un registro oficial en MinCIT, así que la primera
verificación debe hacerse con una estadía real o con el ambiente de
pruebas que indique MinCIT.

El SIRE no va en este servidor todavía: sale por archivo plano mensual
hasta que se tramite la certificación API ante Migración Colombia.
"""

import json
import os
from datetime import datetime

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # el formato vive en GitHub Pages y llama a este servidor desde otro dominio

TRA_ONE = "https://pms.mincit.gov.co/one/"
TRA_TWO = "https://pms.mincit.gov.co/two/"

PROPERTIES = {
    "xia-xue": {"nombre": "Xia Xue House", "env": "XIA_XUE"},
    "iechie": {"nombre": "IeChie by Sua Houses", "env": "IECHIE"},
    "centrico19": {"nombre": "Céntrico19, Industrial Loft", "env": "CENTRICO19"},
}


def _token_and_rnt(slug):
    prop = PROPERTIES.get(slug)
    if not prop:
        return None, None
    suffix = prop["env"]
    return os.environ.get("TRA_TOKEN_" + suffix), os.environ.get("RNT_" + suffix)


def _tra_payload_main(stay, guest, rnt, total_companions):
    return {
        "nombre": guest.get("nombre", ""),
        "apellido": guest.get("apellido", ""),
        "tipo_documento": guest.get("tipo", ""),
        "numero_documento": guest.get("doc", ""),
        "nacionalidad": guest.get("nac", ""),
        "ciudad_residencia": guest.get("residencia", ""),
        "ciudad_procedencia": guest.get("procedencia", ""),
        "motivo_viaje": guest.get("motivo", ""),
        "fecha_hora_ingreso": (stay.get("llegada", "") + " " + stay.get("hora_llegada", "")).strip(),
        "fecha_hora_salida": (stay.get("salida", "") + " " + stay.get("hora_salida", "")).strip(),
        "nombre_establecimiento": stay.get("nombre_propiedad", ""),
        "rnt": rnt,
        "numero_acompanantes": total_companions,
        "tipo_acomodacion": "apartamento",
        "token": "",  # se llena en _send para no dejar el token en el payload guardado
    }


def _tra_payload_companion(stay, guest, main_guest, rnt):
    payload = _tra_payload_main(stay, guest, rnt, 0)
    payload["documento_titular"] = main_guest.get("doc", "")
    return payload


def _send(url, token, payload):
    body = dict(payload)
    body["token"] = token
    headers = {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=body, headers=headers, timeout=30)
    return resp.status_code


@app.route("/api/health", methods=["GET"])
def health():
    ready = [slug for slug in PROPERTIES if _token_and_rnt(slug)[0]]
    return jsonify({"ok": True, "propiedades_con_token": ready})


@app.route("/api/checkin", methods=["POST"])
def checkin():
    data = request.get_json(force=True)
    stay = data.get("stay", {})
    guests = data.get("guests", [])
    slug = stay.get("propiedad", "")

    record = {
        "recibido_en": datetime.utcnow().isoformat() + "Z",
        "stay": stay,
        "guests": guests,
    }
    with open("submissions.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    token, rnt = _token_and_rnt(slug)
    if not token:
        return jsonify({
            "ok": True,
            "tra": "guardado, pendiente de token para " + slug,
        })

    main = next((g for g in guests if g.get("rol") == "Principal"), guests[0] if guests else {})
    companions = [g for g in guests if g.get("rol") != "Principal"]
    results = []
    try:
        code = _send(TRA_ONE, token, _tra_payload_main(stay, main, rnt, len(companions)))
        results.append("principal: " + str(code))
    except Exception as exc:  # noqa: BLE001 - se reporta el fallo sin exponer el token
        results.append("principal: error " + type(exc).__name__)
    for comp in companions:
        try:
            code = _send(TRA_TWO, token, _tra_payload_companion(stay, comp, main, rnt))
            results.append("acompañante " + comp.get("nombre", "") + ": " + str(code))
        except Exception as exc:  # noqa: BLE001
            results.append("acompañante " + comp.get("nombre", "") + ": error " + type(exc).__name__)

    return jsonify({"ok": True, "tra": ", ".join(results)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
