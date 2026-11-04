// Registro de huéspedes Sua Houses: decide TRA y SIRE según nacionalidad.
// TRA: todos los huéspedes. SIRE: solo extranjeros (ingreso y salida).
// Si BACKEND_URL está configurado, el registro se envía al backend, que lo
// guarda y lo transmite a la TRA. Si no, se usa el flujo actual: resumen,
// WhatsApp al anfitrión y descarga en CSV.
(function () {
  var HOST_WHATSAPP = "573152199862";
  var BACKEND_URL = "https://sua-tra-08h8.onrender.com"; // Al desplegar el backend, poner aquí su URL, sin barra final.
  var form = document.getElementById("checkin-form");
  if (!form) return;

  var mainForeignRadios = form.querySelectorAll('input[name="main-colombiano"]');
  var sireMain = document.getElementById("sire-main");
  mainForeignRadios.forEach(function (r) {
    r.addEventListener("change", function () {
      sireMain.classList.toggle("visible", document.querySelector('input[name="main-colombiano"]:checked').value === "no");
      updateSummaryHint();
    });
  });

  var companionsDiv = document.getElementById("companions");
  var compCount = 0;
  document.getElementById("add-companion").addEventListener("click", function () {
    compCount += 1;
    var div = document.createElement("div");
    div.className = "companion";
    div.innerHTML =
      "<h3>Acompañante " + compCount + " / Companion " + compCount + "</h3>" +
      '<label>Nombre completo / Full name<input name="comp-nombre" required></label>' +
      '<div class="row">' +
      '<label>Tipo de documento / Document type<select name="comp-tipo">' +
      "<option>Cédula de ciudadanía</option><option>Cédula de extranjería</option>" +
      "<option>Pasaporte</option><option>PEP</option><option>Otro</option></select></label>" +
      '<label>Número de documento / Document number<input name="comp-doc" required></label>' +
      "</div>" +
      '<label>Nacionalidad / Nationality<input name="comp-nac" required></label>' +
      '<label>¿Es ciudadano colombiano? / Colombian citizen?</label>' +
      '<div class="radio"><label><input type="radio" name="comp-col-' + compCount + '" value="si" checked> Sí / Yes</label>' +
      '<label><input type="radio" name="comp-col-' + compCount + '" value="no"> No</label></div>' +
      '<button type="button" class="remove-btn">Quitar acompañante / Remove</button>';
    div.querySelector(".remove-btn").addEventListener("click", function () {
      div.remove();
      updateSummaryHint();
    });
    div.querySelectorAll('input[type="radio"]').forEach(function (r) {
      r.addEventListener("change", updateSummaryHint);
    });
    companionsDiv.appendChild(div);
    updateSummaryHint();
  });

  function collectGuests() {
    var guests = [];
    var mainCol = document.querySelector('input[name="main-colombiano"]:checked');
    guests.push({
      rol: "Principal",
      nombre: document.getElementById("main-nombres").value.trim(),
      apellido: document.getElementById("main-apellidos").value.trim(),
      tipo: document.getElementById("main-tipo").value,
      doc: document.getElementById("main-doc").value.trim(),
      nac: document.getElementById("main-nac").value.trim(),
      colombiano: mainCol ? mainCol.value === "si" : true,
      residencia: document.getElementById("main-residencia").value.trim(),
      procedencia: document.getElementById("main-procedencia").value.trim(),
      motivo: document.getElementById("main-motivo").value
    });
    companionsDiv.querySelectorAll(".companion").forEach(function (c) {
      var col = c.querySelector('input[type="radio"]:checked');
      guests.push({
        rol: "Acompañante",
        nombre: c.querySelector('[name="comp-nombre"]').value.trim(),
        apellido: "",
        tipo: c.querySelector('[name="comp-tipo"]').value,
        doc: c.querySelector('[name="comp-doc"]').value.trim(),
        nac: c.querySelector('[name="comp-nac"]').value.trim(),
        colombiano: col ? col.value === "si" : true,
        residencia: "",
        procedencia: "",
        motivo: ""
      });
    });
    return guests;
  }

  function collectStay() {
    return {
      propiedad: window.PROP.slug,
      nombre_propiedad: window.PROP.name,
      direccion: window.PROP.address,
      llegada: document.getElementById("llegada").value,
      salida: document.getElementById("salida").value,
      hora_llegada: document.getElementById("hora-llegada").value,
      hora_salida: document.getElementById("hora-salida").value,
      email: document.getElementById("email").value,
      telefono: document.getElementById("telefono").value
    };
  }

  function updateSummaryHint() {
    var guests = collectGuests();
    var foreign = guests.filter(function (g) { return !g.colombiano; });
    var hint = document.getElementById("report-hint");
    if (hint) {
      hint.textContent = "Se reportará en TRA: " + guests.length + " huésped(es). En SIRE: " +
        (foreign.length ? foreign.map(function (g) { return g.nombre; }).join(", ") : "ninguno, todos son colombianos");
    }
  }

  form.addEventListener("input", updateSummaryHint);
  form.addEventListener("change", updateSummaryHint);

  function showResult(stay, guests, backendNote) {
    var foreign = guests.filter(function (g) { return !g.colombiano; });
    var lines = [];
    lines.push("Registro de huéspedes / Guest check in");
    lines.push("Propiedad: " + stay.nombre_propiedad);
    lines.push("Dirección: " + stay.direccion);
    lines.push("Llegada: " + stay.llegada + " " + stay.hora_llegada + " | Salida: " + stay.salida + " " + stay.hora_salida);
    lines.push("Contacto: " + stay.email + " / " + stay.telefono);
    lines.push("TRA: " + guests.length + " huésped(es)");
    guests.forEach(function (g) {
      lines.push("- " + g.rol + ": " + g.nombre + " " + g.apellido + ", " + g.tipo + " " + g.doc + ", " + g.nac);
    });
    lines.push("SIRE: " + (foreign.length ? foreign.map(function (g) { return g.nombre; }).join(", ") : "no aplica"));
    var text = lines.join("\n");

    var summary = document.getElementById("result-summary");
    summary.innerHTML =
      "<p><strong>Registro listo.</strong> El anfitrión transmitirá tu registro a la TRA y, si aplica, al SIRE.</p>" +
      "<p>TRA: " + guests.length + " huésped(es) registrados.</p>" +
      "<p>SIRE (extranjeros, ingreso y salida): " +
      (foreign.length ? foreign.map(function (g) { return g.nombre; }).join(", ") : "no aplica, todos son colombianos") + ".</p>" +
      (backendNote ? "<p>" + backendNote + "</p>" : "") +
      '<p class="small">Si el botón de WhatsApp no abre, descarga el registro en CSV y envíalo al anfitrión.</p>';

    document.getElementById("wa-link").href =
      "https://wa.me/" + HOST_WHATSAPP + "?text=" + encodeURIComponent(text);

    var csv = "propiedad,fecha_llegada,hora_llegada,fecha_salida,hora_salida,rol,nombres,apellidos,tipo_documento,numero_documento,nacionalidad,colombiano,ciudad_residencia,ciudad_procedencia,motivo_viaje,reporta_TRA,reporta_SIRE\n";
    guests.forEach(function (g) {
      csv += [stay.propiedad, stay.llegada, stay.hora_llegada, stay.salida, stay.hora_salida, g.rol,
        '"' + g.nombre.replace(/"/g, '""') + '"', '"' + g.apellido.replace(/"/g, '""') + '"',
        g.tipo, g.doc, g.nac, g.colombiano ? "si" : "no",
        '"' + g.residencia.replace(/"/g, '""') + '"', '"' + g.procedencia.replace(/"/g, '""') + '"', g.motivo,
        "si", g.colombiano ? "no" : "si"
      ].join(",") + "\n";
    });
    document.getElementById("dl-csv").onclick = function () {
      var blob = new Blob([csv], { type: "text/csv" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "registro-" + stay.propiedad + "-" + stay.llegada + ".csv";
      a.click();
    };

    form.style.display = "none";
    var result = document.getElementById("result");
    result.classList.add("visible");
    result.scrollIntoView({ behavior: "smooth" });
  }

  var sending = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    var err = document.getElementById("form-error");
    err.textContent = "";
    if (!document.getElementById("consent").checked) {
      err.textContent = "Debes aceptar la autorización de tratamiento de datos para continuar.";
      return;
    }
    var stay = collectStay();
    if (stay.llegada && stay.salida && stay.salida <= stay.llegada) {
      err.textContent = "La fecha de salida debe ser posterior a la fecha de llegada.";
      return;
    }
    var guests = collectGuests();
    if (!BACKEND_URL) {
      showResult(stay, guests, "");
      return;
    }
    sending = true;
    var btn = form.querySelector("button[type=\"submit\"]");
    var btnText = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando... / Sending...";
    }
    var tries = 0;
    function attempt() {
      tries++;
      fetch(BACKEND_URL + "/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stay: stay, guests: guests })
      }).then(function (r) { return r.json(); }).then(function (data) {
        sending = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = btnText;
        }
        var note = "";
        if (data && data.tra) {
          note = "Transmisión TRA: " + data.tra;
        }
        showResult(stay, guests, note);
      }).catch(function () {
        if (tries < 2) {
          err.textContent = "El servidor está despertando, reintentando el envío... / The server is waking up, retrying...";
          setTimeout(attempt, 3000);
          return;
        }
        sending = false;
        if (btn) {
          btn.disabled = false;
          btn.textContent = btnText;
        }
        showResult(stay, guests, "No se pudo contactar al servidor de registro en este momento. Tu registro quedó listo para enviar por WhatsApp.");
      });
    }
    attempt();
  });
})();
