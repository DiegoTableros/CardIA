"""Base de conocimiento educativa (estatica, revisada a mano).

Fuentes generales: Banxico (reglas de tarjetas de credito) y CONDUSEF (educacion financiera).
Los ejemplos numericos son ilustrativos y simplificados; se indican como tales.
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Topic:
    id: str
    title: str
    keywords: tuple[str, ...]
    summary: str
    body: str


TOPICS: tuple[Topic, ...] = (
    Topic(
        id="que_es_tdc",
        title="¿Qué es y cómo funciona una tarjeta de crédito?",
        keywords=("como funciona", "como funcionan", "que es una tarjeta", "tdc", "credito revolvente"),
        summary="Es un préstamo revolvente: el banco te presta hasta tu línea de crédito y tú lo devuelves.",
        body=(
            "Una **tarjeta de crédito (TDC)** es un **crédito revolvente**: el banco te autoriza un límite "
            "(tu *línea de crédito*) y cada vez que pagas, ese dinero vuelve a estar disponible.\n\n"
            "- **No es tu dinero**: cada compra es una deuda que debes pagar.\n"
            "- Cada mes hay una **fecha de corte** (se suman tus compras del periodo) y una **fecha límite "
            "de pago**.\n"
            "- Si pagas el total del periodo a tiempo, **no pagas intereses** en compras normales.\n"
            "- Si pagas menos, el saldo restante **genera intereses** a la tasa de tu contrato.\n\n"
            "Bien usada, te ayuda a construir **historial crediticio** y a acceder a beneficios. "
            "Mal usada, puede volverse una deuda cara."
        ),
    ),
    Topic(
        id="fecha_corte",
        title="Fecha de corte y fecha límite de pago",
        keywords=("fecha de corte", "corte", "fecha limite", "limite de pago", "cuando pagar", "periodo"),
        summary="El corte cierra tu periodo; la fecha límite es el último día para pagar sin cargos.",
        body=(
            "- **Fecha de corte**: el día en que el banco cierra tu periodo mensual y calcula cuánto debes. "
            "Tu estado de cuenta se genera con esa información.\n"
            "- **Fecha límite de pago**: el último día para pagar. De acuerdo con las reglas de Banxico, no "
            "puede ser menor a **20 días naturales** después del corte.\n\n"
            "**Tip**: una compra hecha justo después del corte tarda más en cobrarse (casi dos meses de "
            "financiamiento sin intereses si eres totalero). Paga siempre antes de la fecha límite para "
            "evitar la comisión por **pago tardío** y afectar tu historial."
        ),
    ),
    Topic(
        id="pago_minimo",
        title="¿Qué es el pago mínimo?",
        keywords=("pago minimo", "minimo", "pagar lo minimo", "solo el minimo"),
        summary="Es lo menos que puedes pagar para no caer en atraso, pero casi todo se va en intereses.",
        body=(
            "El **pago mínimo** es la cantidad más pequeña que puedes pagar para no caer en atraso. "
            "**No te libra de intereses**: el resto del saldo sigue generándolos.\n\n"
            "Según las reglas de Banxico, el pago mínimo es la cantidad **mayor** entre:\n"
            "1. **1.5%** del saldo de la parte revolvente al corte, **más** los intereses del periodo y su IVA.\n"
            "2. **1.25%** de tu límite de crédito.\n\n"
            "A eso se suman las mensualidades de tus compras a **meses sin intereses**.\n\n"
            "**Ejemplo ilustrativo (simplificado)**: debes $10,000, tu tasa es 60% anual (≈5% mensual) y "
            "tu línea es de $20,000.\n"
            "- Intereses del mes: $500 + IVA (16%) $80 = **$580**\n"
            "- Opción 1: $150 (1.5%) + $580 = **$730** · Opción 2: 1.25% × $20,000 = $250\n"
            "- Pago mínimo ≈ **$730**, pero solo **$150** reducen tu deuda.\n\n"
            "Pagando solo el mínimo, una deuda puede tardar **años** en liquidarse. Tu estado de cuenta "
            "incluye una leyenda con el tiempo estimado."
        ),
    ),
    Topic(
        id="pago_no_intereses",
        title="Pago para no generar intereses",
        keywords=(
            "no generar intereses",
            "pago para no generar",
            "sin intereses",
            "evitar intereses",
            "totalero",
            "pagar el total",
        ),
        summary="Es lo que pagas para no generar intereses: tus compras del periodo más las mensualidades de MSI.",
        body=(
            "El **pago para no generar intereses** aparece en tu estado de cuenta. Normalmente incluye:\n"
            "- Las compras y cargos **del periodo** (no a meses).\n"
            "- La **mensualidad** que toca de tus compras a meses sin intereses.\n\n"
            "No es lo mismo que tu **saldo total**: el saldo total incluye también las mensualidades futuras "
            "de tus MSI, que todavía no tienes que pagar.\n\n"
            "Quien paga siempre esta cantidad se llama **totalero**: usa la tarjeta como medio de pago sin "
            "pagar intereses por sus compras.\n\n"
            "**Ojo**: las **disposiciones de efectivo** suelen generar intereses desde el primer día, aunque "
            "pagues el total."
        ),
    ),
    Topic(
        id="cat",
        title="CAT: Costo Anual Total",
        keywords=("cat", "costo anual total", "costo anual"),
        summary="Indicador que resume el costo del crédito (tasa + comisiones) para comparar tarjetas.",
        body=(
            "El **CAT (Costo Anual Total)** es un indicador que incorpora la **tasa de interés**, la "
            "**anualidad** y otras **comisiones** en un solo porcentaje anual. Se expresa **sin IVA** y es "
            "**para fines informativos y de comparación**.\n\n"
            "- Sirve para **comparar** tarjetas: a menor CAT, más barato es financiarte con ella.\n"
            "- Es un **promedio**: tu costo real depende de cómo uses la tarjeta.\n"
            "- Si eres totalero, te afecta más la **anualidad** que el CAT."
        ),
    ),
    Topic(
        id="tasa_interes",
        title="Tasa de interés",
        keywords=("tasa de interes", "tasa", "interes", "intereses", "cuanto cobran de interes"),
        summary="Porcentaje anual que pagas sobre el saldo que no liquidas.",
        body=(
            "La **tasa de interés** (anual) se aplica al saldo que **no pagas** en el periodo. Para estimar "
            "el costo mensual, divide la tasa anual entre 12 (aproximado) y súmale el **IVA de los "
            "intereses** (16%).\n\n"
            "**Ejemplo ilustrativo**: con 60% anual, un saldo de $5,000 genera cerca de $250 de intereses "
            "al mes, más $40 de IVA.\n\n"
            "En México las tasas de tarjeta de crédito son altas comparadas con otros créditos. Por eso "
            "conviene **no financiar compras del día a día**."
        ),
    ),
    Topic(
        id="anualidad",
        title="Anualidad",
        keywords=("anualidad", "cuota anual", "sin anualidad"),
        summary="Cobro anual por tener la tarjeta; algunas no cobran o la bonifican.",
        body=(
            "La **anualidad** es una comisión que se cobra **una vez al año** por tener la tarjeta "
            "(titular y, en su caso, adicionales).\n\n"
            "- Hay tarjetas **sin anualidad**; otras la bonifican si gastas cierto monto.\n"
            "- Una anualidad alta solo vale la pena si **realmente aprovechas** sus beneficios.\n"
            "- Revisa también la anualidad de las **tarjetas adicionales**."
        ),
    ),
    Topic(
        id="msi",
        title="Meses sin intereses (MSI)",
        keywords=("meses sin intereses", "msi", "a meses", "diferir"),
        summary="Divides una compra en mensualidades sin intereses, pero comprometes tu línea.",
        body=(
            "Con **meses sin intereses** divides una compra en pagos mensuales iguales sin intereses.\n\n"
            "- El **monto total** se descuenta de tu línea de crédito desde el primer día.\n"
            "- Cada mensualidad se suma a tu **pago para no generar intereses**.\n"
            "- Si no pagas la mensualidad a tiempo, puedes **perder el beneficio** y generar intereses.\n"
            "- Acumular muchos MSI puede **saturar tu presupuesto** de los meses siguientes."
        ),
    ),
    Topic(
        id="disposicion_efectivo",
        title="Disposición de efectivo",
        keywords=("disposicion de efectivo", "retirar efectivo", "sacar dinero", "cajero", "efectivo"),
        summary="Sacar efectivo con la TDC es de lo más caro: comisión + intereses inmediatos.",
        body=(
            "Retirar efectivo con tu tarjeta de crédito suele implicar:\n"
            "- Una **comisión** por disposición (porcentaje del monto), distinta si es en cajero propio, "
            "de otro banco o en ventanilla.\n"
            "- **Intereses desde el primer día**, sin periodo de gracia.\n\n"
            "Es de las operaciones **más caras**: úsala solo en una emergencia real."
        ),
    ),
    Topic(
        id="buro_score",
        title="Buró de Crédito y score",
        keywords=("buro", "score", "historial crediticio", "historial", "calificacion crediticia"),
        summary="Tu historial de pagos define tu score; pagar a tiempo lo mejora.",
        body=(
            "El **historial crediticio** registra cómo pagas tus créditos. Con él se calcula tu **score**, "
            "que los bancos usan para decidir si te dan crédito y en qué condiciones.\n\n"
            "Para construir un buen historial:\n"
            "- Paga **siempre a tiempo** (aunque sea el mínimo, pero idealmente el total).\n"
            "- Usa una parte moderada de tu línea (evita traerla al tope).\n"
            "- No solicites muchos créditos al mismo tiempo.\n\n"
            "Puedes consultar tu reporte de crédito especial gratis una vez al año en las sociedades de "
            "información crediticia."
        ),
    ),
    Topic(
        id="comisiones",
        title="Tipos de comisiones",
        keywords=(
            "comision",
            "comisiones",
            "cobro",
            "cobros",
            "penalizacion",
            "pago tardio",
            "falta de pago",
        ),
        summary="Obligatorias, por evento y penalizaciones: conócelas para evitar sorpresas.",
        body=(
            "Las comisiones de una tarjeta se agrupan en tres tipos:\n"
            "- **Obligatorias**: se cobran por tener la tarjeta (p. ej. anualidad del titular o adicionales).\n"
            "- **Por evento**: solo si usas cierto servicio (disposición de efectivo, reposición de "
            "plástico, banca por teléfono...).\n"
            "- **Penalizaciones**: por incumplir (pago tardío, falta de pago, sobregiro).\n\n"
            "Las penalizaciones se evitan pagando a tiempo."
        ),
    ),
    Topic(
        id="beneficios",
        title="Beneficios de las tarjetas",
        keywords=("beneficio", "beneficios", "puntos", "recompensas", "descuentos", "seguros", "preventas"),
        summary="Puntos, descuentos, MSI, seguros y preventas: valen si los usas de verdad.",
        body=(
            "Los beneficios más comunes en las tarjetas del mercado mexicano son:\n"
            "- **Meses sin intereses**, **Descuentos** y **Puntos** (los más frecuentes).\n"
            "- **Preventas** de boletos, **Transferencia de saldo** y **Seguros**.\n\n"
            "Un beneficio solo te conviene si **lo usarías de todos modos**. Nunca gastes más para ganar "
            "puntos: los intereses casi siempre cuestan más que la recompensa."
        ),
    ),
    Topic(
        id="transferencia_saldo",
        title="Transferencia de saldo",
        keywords=("transferencia de saldo", "transferir saldo", "pasar deuda", "consolidar"),
        summary="Pasar una deuda a otra tarjeta con mejor tasa, con condiciones y plazos.",
        body=(
            "La **transferencia de saldo** permite pasar la deuda de una tarjeta a otra, a veces con una "
            "tasa promocional menor.\n\n"
            "- Revisa el **plazo** de la promoción y la **tasa** al terminar.\n"
            "- Verifica si hay **comisión** por la transferencia.\n"
            "- Úsala para **liquidar**, no para seguir endeudándote en la tarjeta original."
        ),
    ),
    Topic(
        id="riesgos",
        title="Riesgos y buenas prácticas",
        keywords=("riesgo", "riesgos", "deuda", "endeudamiento", "consejos", "buenas practicas", "cuidado"),
        summary="Evita el sobreendeudamiento: presupuesto, pago total y cuidado con el efectivo.",
        body=(
            "**Riesgos principales**: sobreendeudamiento, pagar solo el mínimo, intereses por disposiciones "
            "de efectivo, acumular MSI y fraudes.\n\n"
            "**Buenas prácticas**:\n"
            "1. Gasta solo lo que **podrías pagar de contado**.\n"
            "2. Paga el **total del periodo** antes de la fecha límite.\n"
            "3. Revisa tu **estado de cuenta** cada mes y reporta cargos no reconocidos.\n"
            "4. Nunca compartas tu NIP, CVV ni códigos de verificación.\n"
            "5. Si ya tienes deuda, prioriza pagar la de **mayor tasa**."
        ),
    ),
)

TOPICS_BY_ID = {t.id: t for t in TOPICS}
