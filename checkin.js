// Registro de huéspedes Sua Houses: decide TRA y SIRE según nacionalidad.
// TRA: todos los huéspedes. SIRE: solo extranjeros (ingreso y salida).
// Versión 1: el registro se entrega por WhatsApp al anfitrión y se descarga en CSV.
// La transmisión automática a los portales del gobierno se conecta en el paso 2.
(function () {
  var HOST_WHATSAPP = "573152199862";
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
      colombiano: mainCol ? mainCol.value === "si" : true
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
        colombiano: col ? col.value === "si" : true
      });
    });
    return guests;
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

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("form-error");
    err.textContent = "";
    if (!document.getElementById("consent").checked) {
      err.textContent = "Debes aceptar la autorización de tratamiento de datos para continuar.";
      return;
    }
    var llegada = document.getElementById("llegada").value;
    var salida = document.getElementById("salida").value;
    if (llegada && salida && salida <= llegada) {
      err.textContent = "La fecha de salida debe ser posterior a la fecha de llegada.";
      return;
    }
    var guests = collectGuests();
    var foreign = guests.filter(function (g) { return !g.colombiano; });

    var lines = [];
    lines.push("Registro de huéspedes / Guest check in");
    lines.push("Propiedad: " + window.PROP.name);
    lines.push("Dirección: " + window.PROP.address);
    lines.push("Llegada: " + llegada + " | Salida: " + salida);
    lines.push("Contacto: " + document.getElementById("email").value + " / " + document.getElementById("telefono").value);
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
      '<p class="small">Si el botón de WhatsApp no abre, descarga el registro en CSV y envíalo al anfitrión.</p>';

    document.getElementById("wa-link").href =
      "https://wa.me/" + HOST_WHATSAPP + "?text=" + encodeURIComponent(text);

    var csv = "propiedad,fecha_llegada,fecha_salida,rol,nombres,apellidos,tipo_documento,numero_documento,nacionalidad,colombiano,reporta_TRA,reporta_SIRE\n";
    guests.forEach(function (g) {
      csv += [window.PROP.slug, llegada, salida, g.rol,
        '"' + g.nombre.replace(/"/g, '""') + '"', '"' + g.apellido.replace(/"/g, '""') + '"',
        g.tipo, g.doc, g.nac, g.colombiano ? "si" : "no", "si", g.colombiano ? "no" : "si"
      ].join(",") + "\n";
    });
    document.getElementById("dl-csv").onclick = function () {
      var blob = new Blob([csv], { type: "text/csv" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "registro-" + window.PROP.slug + "-" + llegada + ".csv";
      a.click();
    };

    form.style.display = "none";
    var result = document.getElementById("result");
    result.classList.add("visible");
    result.scrollIntoView({ behavior: "smooth" });
  });
})();
