/**
 * GrowthFlow Partners — recebe os envios do formulario do site e grava na planilha.
 *
 * Planilha de destino:
 * https://docs.google.com/spreadsheets/d/1AoVBrNgR9q7IzmMCxBvJh-Ygzt8eegRCdrWMp3jXqWY/edit
 *
 * O ID acima e apenas referencia: o script roda dentro da propria planilha
 * (container-bound) e a alcanca por SpreadsheetApp.getActiveSpreadsheet().
 *
 * Instalacao
 *  1. Abra a planilha acima.
 *  2. Extensoes > Apps Script. Apague o conteudo do editor e cole este arquivo.
 *  3. Confira SHEET_GID e NOTIFY_EMAIL abaixo.
 *  4. Implantar > Nova implantacao > tipo "App da Web":
 *       Executar como.......: Eu
 *       Quem pode acessar...: Qualquer pessoa
 *     Autorize quando o Google pedir (o aviso de "app nao verificado" e esperado,
 *     por ser um script seu: Avancado > Acessar <nome do projeto>).
 *  5. Copie a URL que termina em /exec e cole no atributo data-endpoint
 *     do <form> em index.html.
 *
 * Importante: ao editar este arquivo depois, a URL antiga continua rodando a
 * versao anterior. E preciso ir em Implantar > Gerenciar implantacoes, editar a
 * implantacao e escolher "Nova versao".
 *
 * Teste rapido: abra a URL /exec no navegador. Deve responder
 * {"result":"success","message":"up"}.
 */

// Aba de destino, pelo gid que aparece no fim da URL da planilha.
// Deixe null para usar SHEET_NAME em vez do gid.
var SHEET_GID  = 756796263;
var SHEET_NAME = 'Leads';

var NOTIFY_EMAIL = 'contact@gflowpartners.com';  // deixe '' para desligar o aviso por e-mail

var FIELDS   = ['name', 'email', 'company', 'revenue', 'phone'];
var REQUIRED = ['name', 'email', 'company', 'revenue'];

/**
 * Cada campo do formulario e os cabecalhos de coluna que o representam.
 * A gravacao casa pelo NOME do cabecalho, nao pela posicao, para funcionar
 * com as colunas que a planilha ja tem e em qualquer ordem. Se a sua coluna
 * tiver outro titulo, basta acrescenta-lo na lista do campo.
 */
var FIELD_HEADERS = {
  timestamp: ['timestamp', 'data', 'date', 'recebido em', 'created at'],
  name:      ['name', 'nome', 'full name', 'lead'],
  email:     ['work email', 'email', 'e-mail', 'email profissional'],
  company:   ['company name', 'company', 'empresa'],
  revenue:   ['annual revenue', 'revenue', 'faturamento', 'faturamento anual'],
  phone:     ['phone', 'telefone', 'celular', 'whatsapp']
};

// Usado so quando a aba esta vazia e precisa ganhar um cabecalho.
var DEFAULT_HEADERS = ['Timestamp', 'Name', 'Work email', 'Company', 'Annual revenue', 'Phone'];
var DEFAULT_ORDER   = ['timestamp', 'name', 'email', 'company', 'revenue', 'phone'];

function doPost(e) {
  try {
    var data = (e && e.parameter) || {};

    // Honeypot: campo escondido no site, que humanos nunca preenchem.
    // Responde sucesso de proposito, para o bot nao descobrir que foi barrado.
    if (String(data.website || '').trim()) {
      return ok('ignored');
    }

    for (var i = 0; i < REQUIRED.length; i++) {
      if (!String(data[REQUIRED[i]] || '').trim()) {
        return fail('campo obrigatorio ausente: ' + REQUIRED[i]);
      }
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email).trim())) {
      return fail('e-mail invalido');
    }

    var values = { timestamp: new Date() };
    FIELDS.forEach(function (f) { values[f] = String(data[f] || '').trim(); });

    // Dois envios simultaneos poderiam disputar a mesma linha.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = getSheet();
      sheet.appendRow(buildRow(sheet, values));
    } finally {
      lock.releaseLock();
    }

    notify(data);
    return ok('saved');
  } catch (err) {
    console.error(err);
    return fail(String(err));
  }
}

// GET serve so para conferir no navegador que a implantacao esta de pe.
function doGet() {
  return ok('up');
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (SHEET_GID !== null && SHEET_GID !== '') {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getSheetId() === SHEET_GID) return all[i];
    }
    // Melhor falhar alto do que gravar na aba errada.
    throw new Error('nenhuma aba com gid ' + SHEET_GID + ' nesta planilha');
  }

  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

/**
 * Monta a linha na largura e na ordem do cabecalho que a aba realmente tem.
 * Colunas que o formulario nao alimenta ficam em branco, e campos sem coluna
 * correspondente sao registrados no log em vez de sumirem calados.
 */
function buildRow(sheet, values) {
  var lastCol = sheet.getLastColumn();

  // Aba vazia: cria o cabecalho padrao antes de gravar.
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    sheet.appendRow(DEFAULT_HEADERS);
    sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return DEFAULT_ORDER.map(function (f) { return values[f]; });
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader);
  var row = [];
  for (var i = 0; i < lastCol; i++) row.push('');

  var placed = 0;
  var missing = [];

  Object.keys(FIELD_HEADERS).forEach(function (field) {
    var aliases = FIELD_HEADERS[field];
    var idx = -1;
    for (var i = 0; i < aliases.length && idx === -1; i++) {
      idx = headers.indexOf(normalizeHeader(aliases[i]));
    }
    if (idx === -1) {
      missing.push(field);
      return;
    }
    row[idx] = values[field];
    placed++;
  });

  if (missing.length) {
    console.warn('sem coluna para: ' + missing.join(', ') +
                 ' | cabecalho da aba: ' + headers.join(' | '));
  }

  // Nenhuma coluna reconhecida: gravar seria espalhar dados em celulas erradas.
  if (placed === 0) {
    throw new Error('nenhuma coluna reconhecida no cabecalho: ' + headers.join(' | '));
  }

  return row;
}

// Compara cabecalhos ignorando caixa, acento e espaco sobrando.
function normalizeHeader(h) {
  var s = String(h === null || h === undefined ? '' : h).trim().toLowerCase();
  try {
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch (err) {
    // Runtime antigo sem normalize: segue sem remover acentos.
  }
  return s.replace(/\s+/g, ' ');
}

function notify(data) {
  if (!NOTIFY_EMAIL) return;
  try {
    var body = FIELDS.map(function (f) {
      return f + ': ' + (String(data[f] || '').trim() || '-');
    }).join('\n');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: 'Novo lead no site: ' + String(data.name || '').trim(),
      body: body + '\n\nPlanilha: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
  } catch (err) {
    // Um e-mail que falha nao pode derrubar a gravacao do lead.
    console.error('notify falhou: ' + err);
  }
}

function ok(msg)   { return json({ result: 'success', message: msg }); }
function fail(msg) { return json({ result: 'error',   message: msg }); }

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
