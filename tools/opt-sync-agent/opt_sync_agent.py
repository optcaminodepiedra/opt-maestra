#!/usr/bin/env python3
"""OPT Sync Agent · SoftRestaurant

Agente local sin dependencias externas. Vigila una carpeta con XML de
SoftRestaurant y envía ventas, líneas, pagos y cancelaciones a OPT Maestra.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import socket
import ssl
import sys
import time
import traceback
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

VERSION = "1.0.0"
SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "config.json"
STATE_PATH = SCRIPT_DIR / "state.json"
LOG_DIR = SCRIPT_DIR / "logs"
LOG_PATH = LOG_DIR / "agent.log"

FILE_DEFINITIONS = {
    "cheques.xml": {
        "tag": "curcheques",
        "required": True,
        "fields": {
            "folio", "fecha", "cierre", "mesa", "nopersonas", "mesero", "total",
            "subtotal", "descuento", "propina", "propinaincluida", "totalarticulos",
            "cancelado", "razoncancelado", "numcheque", "idturno", "tipodeservicio",
        },
    },
    "cheqdet.xml": {
        "tag": "curcheqdet",
        "required": True,
        "fields": {
            "foliodet", "movimiento", "cantidad", "claveprod", "precio", "descuento",
            "impuesto", "preciocatalogo", "hora", "modificador", "idproductocompuesto",
            "productocompuestoprincipal", "comentario", "estacion", "idmeseroproducto",
            "comanda",
        },
    },
    "chequespagos.xml": {
        "tag": "curchequespagos",
        "required": False,
        "fields": {
            "folio", "idformadepago", "importe", "propina", "tipodecambio", "referencia",
        },
    },
    "cancela.xml": {
        "tag": "curcancela",
        "required": False,
        "fields": {"folio"},
    },
}

DEFAULT_CONFIG = {
    "apiBaseUrl": "https://app.optcaminodepiedra.com",
    "token": "",
    "xmlFolder": "",
    "recursive": True,
    "pollSeconds": 60,
    "stableSeconds": 15,
    "chunkSize": 40,
    "requestTimeoutSeconds": 90,
    "sourceVersion": "",
    "verifySsl": True,
}


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def rotate_log_if_needed() -> None:
    try:
        if LOG_PATH.exists() and LOG_PATH.stat().st_size > 5 * 1024 * 1024:
            backup = LOG_DIR / "agent-anterior.log"
            if backup.exists():
                backup.unlink()
            LOG_PATH.replace(backup)
    except OSError:
        pass


def log(message: str, level: str = "INFO") -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    rotate_log_if_needed()
    line = f"[{now_text()}] [{level}] {message}"
    print(line, flush=True)
    try:
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass


def read_json(path: Path, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not path.exists():
        return dict(fallback)
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else dict(fallback)
    except (OSError, json.JSONDecodeError):
        return dict(fallback)


def write_json_atomic(path: Path, value: Dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
    temporary.replace(path)


def load_config() -> Dict[str, Any]:
    config = dict(DEFAULT_CONFIG)
    config.update(read_json(CONFIG_PATH, {}))
    return config


def ask(prompt: str, default: str = "", secret: bool = False) -> str:
    suffix = "" if secret else (f" [{default}]" if default else "")
    if secret:
        try:
            import getpass
            value = getpass.getpass(f"{prompt}{suffix}: ").strip()
        except Exception:
            value = input(f"{prompt}{suffix}: ").strip()
    else:
        value = input(f"{prompt}{suffix}: ").strip()
    return value or default


def configure() -> Dict[str, Any]:
    current = load_config()
    print("\nCONFIGURACIÓN DEL AGENTE OPT · SOFTRESTAURANT\n")
    print("El token se obtiene en OPT Maestra > Administración > Integraciones.")
    print("La carpeta debe contener cheques.xml y cheqdet.xml.\n")

    api_url = ask("URL de OPT Maestra", str(current.get("apiBaseUrl") or DEFAULT_CONFIG["apiBaseUrl"]))
    token_default = str(current.get("token") or "")
    token = ask("Token opt_sync_...", token_default, secret=True)
    xml_folder = ask("Carpeta donde están los XML", str(current.get("xmlFolder") or ""))
    poll_seconds = ask("Revisar cada cuántos segundos", str(current.get("pollSeconds") or 60))
    source_version = ask("Versión de SoftRestaurant (opcional)", str(current.get("sourceVersion") or ""))

    config = dict(DEFAULT_CONFIG)
    config.update({
        "apiBaseUrl": api_url.rstrip("/"),
        "token": token,
        "xmlFolder": str(Path(xml_folder).expanduser()) if xml_folder else "",
        "pollSeconds": max(30, int(poll_seconds or 60)),
        "sourceVersion": source_version,
    })
    write_json_atomic(CONFIG_PATH, config)
    print(f"\nConfiguración guardada en:\n{CONFIG_PATH}\n")
    return config


def validate_config(config: Dict[str, Any]) -> None:
    if not str(config.get("apiBaseUrl") or "").startswith(("http://", "https://")):
        raise ValueError("La URL de OPT Maestra no es válida.")
    if not str(config.get("token") or "").startswith("opt_sync_"):
        raise ValueError("El token no es válido. Debe comenzar con opt_sync_.")
    folder_value = str(config.get("xmlFolder") or "").strip()
    if not folder_value:
        raise ValueError("No se configuró la carpeta de XML.")
    folder = Path(folder_value)
    if not folder.is_dir():
        raise ValueError(f"La carpeta de XML no existe: {folder}")


def ssl_context(config: Dict[str, Any]) -> ssl.SSLContext:
    if bool(config.get("verifySsl", True)):
        return ssl.create_default_context()
    return ssl._create_unverified_context()  # noqa: SLF001 - opción de diagnóstico local


def post_json(config: Dict[str, Any], endpoint: str, payload: Dict[str, Any], attempts: int = 3) -> Dict[str, Any]:
    url = str(config["apiBaseUrl"]).rstrip("/") + endpoint
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {config['token']}",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": f"OPT-Sync-Agent/{VERSION}",
        },
    )

    timeout = max(20, int(config.get("requestTimeoutSeconds", 90)))
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout, context=ssl_context(config)) as response:
                raw = response.read().decode("utf-8", errors="replace")
                data = json.loads(raw) if raw else {}
                if not isinstance(data, dict):
                    raise RuntimeError("La plataforma devolvió una respuesta inesperada.")
                return data
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(detail)
                message = parsed.get("error") or detail
            except json.JSONDecodeError:
                message = detail or str(error)
            last_error = RuntimeError(f"HTTP {error.code}: {message}")
            if 400 <= error.code < 500 and error.code != 429:
                break
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            last_error = error

        if attempt < attempts:
            wait = min(20, 2 ** attempt)
            log(f"Intento {attempt} falló. Reintentando en {wait}s: {last_error}", "WARN")
            time.sleep(wait)

    raise RuntimeError(str(last_error or "No se pudo conectar con OPT Maestra."))


def heartbeat(config: Dict[str, Any]) -> Dict[str, Any]:
    return post_json(config, "/api/sync/v1/heartbeat", {
        "agentVersion": VERSION,
        "computerName": socket.gethostname(),
        "sourceVersion": config.get("sourceVersion") or None,
    })


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_records(path: Path, record_tag: str, allowed_fields: Iterable[str]) -> List[Dict[str, str]]:
    allowed = set(allowed_fields)
    records: List[Dict[str, str]] = []
    try:
        for _, element in ET.iterparse(str(path), events=("end",)):
            if local_name(element.tag).lower() != record_tag.lower():
                continue
            record: Dict[str, str] = {}
            for child in list(element):
                name = local_name(child.tag).lower()
                if name in allowed:
                    record[name] = (child.text or "").strip()
            records.append(record)
            element.clear()
    except ET.ParseError as error:
        raise RuntimeError(f"XML inválido en {path.name}: {error}") from error
    except OSError as error:
        raise RuntimeError(f"No se pudo leer {path}: {error}") from error
    return records


def find_source_files(config: Dict[str, Any]) -> Dict[str, Path]:
    root = Path(str(config["xmlFolder"]))
    recursive = bool(config.get("recursive", True))
    found: Dict[str, Path] = {}

    if recursive:
        candidates = root.rglob("*.xml")
    else:
        candidates = root.glob("*.xml")

    for path in candidates:
        name = path.name.lower()
        if name in FILE_DEFINITIONS and name not in found:
            found[name] = path

    return found


def validate_required_files(files: Dict[str, Path]) -> None:
    missing = [name for name, definition in FILE_DEFINITIONS.items() if definition["required"] and name not in files]
    if missing:
        raise RuntimeError("Faltan archivos obligatorios: " + ", ".join(missing))


def file_signature(files: Dict[str, Path]) -> str:
    pieces: List[str] = []
    for name in sorted(files):
        stat = files[name].stat()
        pieces.append(f"{name}|{stat.st_size}|{stat.st_mtime_ns}")
    return hashlib.sha256("\n".join(pieces).encode("utf-8")).hexdigest()


def wait_until_stable(files: Dict[str, Path], stable_seconds: int) -> None:
    if stable_seconds <= 0:
        return
    first = file_signature(files)
    time.sleep(stable_seconds)
    second = file_signature(files)
    if first != second:
        raise RuntimeError("Los XML todavía están cambiando. Se intentará de nuevo en la siguiente revisión.")


def group_by(records: List[Dict[str, str]], key: str) -> Dict[str, List[Dict[str, str]]]:
    grouped: Dict[str, List[Dict[str, str]]] = {}
    for record in records:
        value = str(record.get(key) or "").strip()
        if value:
            grouped.setdefault(value, []).append(record)
    return grouped


def chunked(values: List[Dict[str, str]], size: int) -> Iterable[List[Dict[str, str]]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def sync_once(config: Dict[str, Any], force: bool = False) -> Dict[str, Any]:
    validate_config(config)
    state = read_json(STATE_PATH, {})

    connection = heartbeat(config)
    connector = connection.get("connector") or {}
    log(f"Conectado: {connector.get('name', 'conector')} · {connector.get('businessName', 'negocio')}")

    files = find_source_files(config)
    validate_required_files(files)
    signature = file_signature(files)
    if not force and signature == state.get("lastSuccessfulSignature"):
        log("No hay cambios en los XML. Solo se envió el heartbeat.")
        return {"ok": True, "changed": False}

    wait_until_stable(files, max(0, int(config.get("stableSeconds", 15))))
    signature = file_signature(files)
    snapshot_id = signature[:24]

    parsed: Dict[str, List[Dict[str, str]]] = {}
    for name, path in files.items():
        definition = FILE_DEFINITIONS[name]
        log(f"Leyendo {name}: {path}")
        parsed[name] = parse_records(path, str(definition["tag"]), definition["fields"])
        log(f"  {len(parsed[name])} registros")

    cheques = [record for record in parsed.get("cheques.xml", []) if record.get("folio")]
    lines_by_folio = group_by(parsed.get("cheqdet.xml", []), "foliodet")
    payments_by_folio = group_by(parsed.get("chequespagos.xml", []), "folio")
    canceled_folios = sorted({
        str(record.get("folio") or "").strip()
        for record in parsed.get("cancela.xml", [])
        if str(record.get("folio") or "").strip()
    })

    start = post_json(config, "/api/sync/v1/softrestaurant", {
        "action": "start",
        "snapshotId": snapshot_id,
        "agentVersion": VERSION,
        "computerName": socket.gethostname(),
        "sourceVersion": config.get("sourceVersion") or None,
        "xmlFolder": str(config.get("xmlFolder") or ""),
        "totalCheques": len(cheques),
        "totalLines": sum(len(value) for value in lines_by_folio.values()),
        "totalPayments": sum(len(value) for value in payments_by_folio.values()),
    })
    run_id = str(start.get("runId") or "")
    if not run_id:
        raise RuntimeError("La plataforma no devolvió runId.")

    totals = {
        "salesCreated": 0,
        "salesUpdated": 0,
        "salesSkipped": 0,
        "salesErrors": 0,
        "linesCreated": 0,
        "paymentsCreated": 0,
        "phantomsCreated": 0,
        "canceledSales": 0,
    }

    size = min(100, max(10, int(config.get("chunkSize", 40))))
    chunks = list(chunked(cheques, size))
    for position, cheque_chunk in enumerate(chunks, start=1):
        folios = {str(item.get("folio") or "").strip() for item in cheque_chunk}
        payload = {
            "action": "chunk",
            "runId": run_id,
            "chunkIndex": position,
            "chunkCount": len(chunks),
            "cheques": cheque_chunk,
            "cheqdetByFolio": {folio: lines_by_folio.get(folio, []) for folio in folios},
            "pagosByFolio": {folio: payments_by_folio.get(folio, []) for folio in folios},
            "canceladosFolios": [folio for folio in canceled_folios if folio in folios],
        }
        response = post_json(config, "/api/sync/v1/softrestaurant", payload)
        stats = response.get("stats") or {}
        for key in totals:
            totals[key] += int(stats.get(key) or 0)
        log(
            f"Bloque {position}/{len(chunks)}: "
            f"{stats.get('salesCreated', 0)} nuevas, "
            f"{stats.get('salesUpdated', 0)} actualizadas, "
            f"{stats.get('salesSkipped', 0)} existentes"
        )

    # Cubre cancelaciones cuyo folio ya no aparezca dentro de cheques.xml.
    cheque_folios = {str(item.get("folio") or "").strip() for item in cheques}
    orphan_cancellations = [folio for folio in canceled_folios if folio not in cheque_folios]
    cancellation_chunks = list(chunked([{"folio": folio} for folio in orphan_cancellations], 100))
    for extra_index, cancellation_chunk in enumerate(cancellation_chunks, start=1):
        response = post_json(config, "/api/sync/v1/softrestaurant", {
            "action": "chunk",
            "runId": run_id,
            "chunkIndex": len(chunks) + extra_index,
            "chunkCount": len(chunks) + len(cancellation_chunks),
            "cheques": [],
            "cheqdetByFolio": {},
            "pagosByFolio": {},
            "canceladosFolios": [item["folio"] for item in cancellation_chunk],
        })
        stats = response.get("stats") or {}
        for key in totals:
            totals[key] += int(stats.get(key) or 0)

    finish = post_json(config, "/api/sync/v1/softrestaurant", {
        "action": "finish",
        "runId": run_id,
        "checkpoint": snapshot_id,
        "finishedAt": datetime.now().isoformat(),
        "stats": totals,
    })

    state.update({
        "lastSuccessfulSignature": signature,
        "lastSnapshotId": snapshot_id,
        "lastRunId": run_id,
        "lastSuccessAt": datetime.now().isoformat(),
        "lastTotals": totals,
    })
    write_json_atomic(STATE_PATH, state)

    log(
        "Sincronización terminada: "
        f"{totals['salesCreated']} ventas nuevas, "
        f"{totals['salesUpdated']} actualizadas, "
        f"{totals['salesSkipped']} existentes, "
        f"{totals['salesErrors']} errores."
    )
    return {"ok": True, "changed": True, "finish": finish, "totals": totals}


def run_loop(config: Dict[str, Any]) -> None:
    interval = max(30, int(config.get("pollSeconds", 60)))
    log(f"OPT Sync Agent {VERSION} iniciado en {platform.platform()}")
    log(f"Revisión cada {interval} segundos. Ctrl+C para detener.")
    while True:
        try:
            sync_once(config)
        except KeyboardInterrupt:
            raise
        except Exception as error:
            log(str(error), "ERROR")
            log(traceback.format_exc(), "DEBUG")
        time.sleep(interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="Agente de sincronización OPT para SoftRestaurant")
    parser.add_argument("--configure", action="store_true", help="Crear o modificar config.json")
    parser.add_argument("--test", action="store_true", help="Probar token y conexión")
    parser.add_argument("--once", action="store_true", help="Sincronizar una vez y salir")
    parser.add_argument("--force", action="store_true", help="Sincronizar aunque los archivos no hayan cambiado")
    args = parser.parse_args()

    try:
        config = configure() if args.configure else load_config()
        if not CONFIG_PATH.exists() and not args.configure:
            print("No existe config.json. Ejecuta configurar_agente.cmd primero.")
            return 2

        validate_config(config)

        if args.test:
            result = heartbeat(config)
            connector = result.get("connector") or {}
            print("\nCONEXIÓN CORRECTA")
            print(f"Integración: {connector.get('name', '-')}")
            print(f"Negocio: {connector.get('businessName', '-')}")
            return 0

        if args.once:
            sync_once(config, force=args.force)
            return 0

        run_loop(config)
        return 0
    except KeyboardInterrupt:
        log("Agente detenido por el usuario.")
        return 0
    except Exception as error:
        log(str(error), "ERROR")
        if not args.once:
            input("\nPresiona ENTER para cerrar...")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
