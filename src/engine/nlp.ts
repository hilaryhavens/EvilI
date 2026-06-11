import winkNLP, { type WinkMethods } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

let instance: WinkMethods | null = null;
export function getNlp(): WinkMethods {
  if (!instance) instance = winkNLP(model);
  return instance;
}
