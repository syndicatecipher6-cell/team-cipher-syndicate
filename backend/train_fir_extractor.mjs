import fs from 'node:fs';
import path from 'node:path';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 2) throw new Error('The CSV has no data rows.');
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function baseTokens(text) {
  const normalized = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, ' date_token ')
    .replace(/(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/g, ' phone_token ')
    .replace(/\b[a-z]{2}[\s-]?\d{1,2}[\s-]?[a-z]{1,3}[\s-]?\d{4}\b/g, ' vehicle_token ')
    .replace(/\b\d[\d,]*(?:\.\d+)?\b/g, ' number_token ')
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();
  return normalized ? normalized.split(/\s+/) : [];
}

function documentFeatures(text) {
  const tokens = baseTokens(text);
  const features = [...tokens.map((token) => `u:${token}`)];
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    features.push(`b:${tokens[index]}_${tokens[index + 1]}`);
  }
  return features;
}

function roleFeatures(text, personName) {
  const escaped = personName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marked = text.replace(new RegExp(escaped, 'gi'), ' person_marker ');
  const tokens = baseTokens(marked);
  const marker = tokens.indexOf('person_marker');
  if (marker < 0) return documentFeatures(text);
  const features = [];
  for (let offset = -16; offset <= 16; offset += 1) {
    if (offset === 0) continue;
    const token = tokens[marker + offset];
    if (token) {
      const side = offset < 0 ? 'before' : 'after';
      features.push(`${side}:${token}`);
      if (Math.abs(offset) <= 6) features.push(`${side}:${Math.abs(offset)}:${token}`);
    }
  }
  const contextStart = Math.max(0, marker - 16);
  const contextEnd = Math.min(tokens.length, marker + 17);
  const context = tokens.slice(contextStart, contextEnd);
  for (const token of context) {
    if (token !== 'person_marker') features.push(`context:${token}`);
  }
  for (let index = 0; index + 1 < context.length; index += 1) {
    features.push(`context_bigram:${context[index]}_${context[index + 1]}`);
  }
  const contextText = context.join(' ');
  const roleCues = {
    suspect: /\b(?:suspect|accused|ringleader|offender|perpetrator|apprehended|arrested|detained|tracking)\b/,
    witness: /\b(?:witness|eyewitness|observed|witnessed|saw|corroborated)\b/,
    complainant: /\b(?:complainant|complaint|lodged|personally reported|submitted a written complaint)\b/,
    officer: /\b(?:inspector|sub inspector|officer|constable|official capacity|assigned to)\b/,
  };
  for (const [role, pattern] of Object.entries(roleCues)) {
    if (pattern.test(contextText)) features.push(...Array(12).fill(`role_cue:${role}`));
  }
  return features;
}

function trainNaiveBayes(samples, featureExtractor, options = {}) {
  const minDocumentFrequency = options.minDocumentFrequency ?? 2;
  const maxVocabulary = options.maxVocabulary ?? 12000;
  const alpha = options.alpha ?? 0.5;
  const documentFrequency = new Map();
  for (const sample of samples) {
    for (const feature of new Set(featureExtractor(sample))) {
      documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1);
    }
  }
  const vocabulary = [...documentFrequency.entries()]
    .filter(([, count]) => count >= minDocumentFrequency)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxVocabulary)
    .map(([feature]) => feature);
  const vocabularySet = new Set(vocabulary);
  const labels = [...new Set(samples.map((sample) => sample.label))].sort();
  const classDocuments = Object.fromEntries(labels.map((label) => [label, 0]));
  const classTotals = Object.fromEntries(labels.map((label) => [label, 0]));
  const counts = Object.fromEntries(labels.map((label) => [label, new Map()]));

  for (const sample of samples) {
    classDocuments[sample.label] += 1;
    for (const feature of featureExtractor(sample)) {
      if (!vocabularySet.has(feature)) continue;
      counts[sample.label].set(feature, (counts[sample.label].get(feature) ?? 0) + 1);
      classTotals[sample.label] += 1;
    }
  }

  const logPrior = {};
  const unknownLogProbability = {};
  const logLikelihood = {};
  for (const label of labels) {
    logPrior[label] = Math.log(classDocuments[label] / samples.length);
    const denominator = classTotals[label] + alpha * (vocabulary.length + 1);
    unknownLogProbability[label] = Math.log(alpha / denominator);
    const weights = {};
    for (const [feature, count] of counts[label]) {
      weights[feature] = Math.log((count + alpha) / denominator);
    }
    logLikelihood[label] = weights;
  }
  return { type: 'multinomial_naive_bayes', alpha, labels, vocabulary, logPrior, unknownLogProbability, logLikelihood };
}

function predict(model, features) {
  const vocabularySet = model._vocabularySet ?? new Set(model.vocabulary);
  model._vocabularySet = vocabularySet;
  let bestLabel = model.labels[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  const scores = {};
  for (const label of model.labels) {
    let score = model.logPrior[label];
    const weights = model.logLikelihood[label];
    for (const feature of features) {
      if (!vocabularySet.has(feature)) continue;
      score += weights[feature] ?? model.unknownLogProbability[label];
    }
    scores[label] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }
  const maxScore = Math.max(...Object.values(scores));
  const expScores = Object.fromEntries(Object.entries(scores).map(([label, score]) => [label, Math.exp(score - maxScore)]));
  const total = Object.values(expScores).reduce((sum, value) => sum + value, 0);
  return { label: bestLabel, confidence: expScores[bestLabel] / total };
}

function metrics(model, samples, featureExtractor) {
  const labels = model.labels;
  const confusion = Object.fromEntries(labels.map((actual) => [actual, Object.fromEntries(labels.map((predicted) => [predicted, 0]))]));
  let correct = 0;
  let confidenceTotal = 0;
  for (const sample of samples) {
    const result = predict(model, featureExtractor(sample));
    confusion[sample.label][result.label] += 1;
    correct += Number(result.label === sample.label);
    confidenceTotal += result.confidence;
  }
  const perClass = {};
  for (const label of labels) {
    const truePositive = confusion[label][label];
    const falsePositive = labels.reduce((sum, actual) => sum + (actual === label ? 0 : confusion[actual][label]), 0);
    const falseNegative = labels.reduce((sum, predicted) => sum + (predicted === label ? 0 : confusion[label][predicted]), 0);
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    const recall = truePositive / Math.max(1, truePositive + falseNegative);
    perClass[label] = { precision, recall, f1: (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall), support: Object.values(confusion[label]).reduce((a, b) => a + b, 0) };
  }
  return {
    samples: samples.length,
    accuracy: correct / Math.max(1, samples.length),
    macroF1: labels.reduce((sum, label) => sum + perClass[label].f1, 0) / labels.length,
    meanConfidence: confidenceTotal / Math.max(1, samples.length),
    perClass,
    confusion,
  };
}

function parsePeople(row) {
  const value = JSON.parse(row.persons);
  if (!Array.isArray(value)) throw new Error(`persons must be an array for ${row.case_id}`);
  return value;
}

function narrativeAugmentations() {
  const crimes = [
    'Abduction', 'Bootlegging', 'Cattle Smuggling', 'Contraband Smuggling',
    'Counterfeit Currency', 'Cyber Fraud', 'Hawala Transactions',
    'Illegal Wildlife Trade', 'Organized Robbery', 'Ransomware Extortion',
  ];
  const names = [
    'Aarav Mehta', 'Aditi Rao', 'Akash Verma', 'Ananya Sen', 'Arjun Nair',
    'Deepa Iyer', 'Dev Malhotra', 'Farhan Ali', 'Ishita Das', 'Kabir Singh',
    'Kavya Reddy', 'Meera Nair', 'Neha Yadav', 'Nikhil Joshi', 'Priya Sen',
    'Rahul Kapoor', 'Ravi Banerjee', 'Riya Sharma', 'Sanjay Patel', 'Vijay Kumar',
  ];
  const templates = {
    suspect: [
      'Security footage identified the ringleader as {name}.',
      'Authorities apprehended {name} at the scene.',
      'Investigators named {name} as the primary accused.',
      'Police are currently tracking {name} and known associates.',
      'The suspect, {name}, was seen leaving the premises.',
      '{name} was actively using the facility during the offence.',
      'Officers detained {name} after reviewing the evidence.',
      'Records identify {name} as a person of interest in the offence.',
    ],
    witness: [
      'Eyewitness {name} observed the incident.',
      '{name} witnessed the exchange and gave a statement.',
      'Investigators interviewed witness {name}.',
      'The account supplied by {name} corroborated the timeline.',
      '{name} saw the accused leave the location.',
      'A sworn statement was recorded from informant {name}.',
      'Witness name: {name}.',
      '{name}, an eyewitness, identified the vehicle.',
    ],
    complainant: [
      'Complainant {name} filed the report.',
      '{name} personally reported the incident to police.',
      'The complaint was lodged by {name}.',
      '{name} submitted a written complaint at the station.',
      'Police registered the FIR following a report from {name}.',
      'The informant named in the complaint is {name}.',
      'Complainant name: {name}.',
      '{name}, the complainant, described the loss.',
    ],
    officer: [
      'Inspector {name} recorded the complaint.',
      'Investigating officer {name} secured the evidence.',
      '{name}, a police officer, led the inquiry.',
      'Constable {name} prepared the seizure memo.',
      'The investigation was assigned to Officer {name}.',
      '{name} recorded the statement in an official capacity.',
      'Officer name: {name}.',
      'Sub-inspector {name} conducted the search.',
    ],
  };
  const roles = Object.keys(templates);
  const rows = [];
  let sequence = 0;
  for (const [crimeIndex, crime] of crimes.entries()) {
    for (const [roleIndex, role] of roles.entries()) {
      for (let variant = 0; variant < templates[role].length; variant += 1) {
        const name = names[(crimeIndex * 7 + roleIndex * 3 + variant) % names.length];
        const wording = templates[role][variant].replace('{name}', name);
        const split = variant === 0 ? 'val' : variant === 1 ? 'test' : 'train';
        sequence += 1;
        rows.push({
          case_id: `AUG-${String(sequence).padStart(4, '0')}`,
          fir_number: `FIR-AUG-${String(sequence).padStart(4, '0')}`,
          fir_text: `This FIR concerns ${crime}. ${wording} The record was preserved for investigation.`,
          crime_type: crime,
          persons: JSON.stringify([{ name, role }]),
          phones: '[]',
          vehicles: '[]',
          split,
        });
      }
    }
  }
  return rows;
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? path.resolve('backend/models/fir_extractor_model.json');
if (!inputPath) {
  console.error('Usage: node backend/train_fir_extractor.mjs <dataset.csv> [output.json]');
  process.exit(2);
}

const sourceRows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
const required = ['case_id', 'fir_number', 'fir_text', 'crime_type', 'persons', 'split'];
for (const column of required) {
  if (!(column in sourceRows[0])) throw new Error(`Missing required column: ${column}`);
}
const augmentations = narrativeAugmentations();
const rows = [...sourceRows, ...augmentations];
const allowedSplits = new Set(['train', 'val', 'test']);
for (const row of rows) {
  if (!allowedSplits.has(row.split)) throw new Error(`Invalid split '${row.split}' for ${row.case_id}`);
  if (!row.fir_text.trim() || !row.crime_type.trim()) throw new Error(`Missing training text or label for ${row.case_id}`);
}

const crimeSamples = rows.map((row) => ({ text: row.fir_text, label: row.crime_type, split: row.split }));
const roleSamples = rows.flatMap((row) => parsePeople(row).map((person) => ({
  text: row.fir_text,
  personName: person.name,
  label: String(person.role).toLowerCase(),
  split: row.split,
}))).filter((sample) => sample.personName && sample.label);

const crimeModel = trainNaiveBayes(
  crimeSamples.filter((sample) => sample.split === 'train'),
  (sample) => documentFeatures(sample.text),
  { minDocumentFrequency: 2, maxVocabulary: 14000 },
);
const roleModel = trainNaiveBayes(
  roleSamples.filter((sample) => sample.split === 'train'),
  (sample) => roleFeatures(sample.text, sample.personName),
  { minDocumentFrequency: 2, maxVocabulary: 10000 },
);

const artifact = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  source: {
    filename: path.basename(inputPath),
    rows: rows.length,
    baseRows: sourceRows.length,
    narrativeAugmentationRows: augmentations.length,
    synthetic: true,
  },
  preprocessing: { unicode: 'NFKC', features: ['word unigrams', 'word bigrams', 'normalized identifiers'] },
  crimeClassifier: crimeModel,
  personRoleClassifier: roleModel,
  metrics: {
    crimeValidation: metrics(crimeModel, crimeSamples.filter((sample) => sample.split === 'val'), (sample) => documentFeatures(sample.text)),
    crimeTest: metrics(crimeModel, crimeSamples.filter((sample) => sample.split === 'test'), (sample) => documentFeatures(sample.text)),
    roleValidation: metrics(roleModel, roleSamples.filter((sample) => sample.split === 'val'), (sample) => roleFeatures(sample.text, sample.personName)),
    roleTest: metrics(roleModel, roleSamples.filter((sample) => sample.split === 'test'), (sample) => roleFeatures(sample.text, sample.personName)),
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, ...artifact.metrics }, null, 2));
