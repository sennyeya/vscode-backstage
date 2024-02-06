import {
  SemanticTokenModifiers,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokenTypes,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  Node,
  Scalar,
  YAMLMap,
} from 'yaml';
import { IOption } from '../interfaces/module';
import { getOrigRange, parseAllDocuments } from '../utils/yaml';
import { toLspRange } from '../utils/misc';

export const tokenTypes = [
  SemanticTokenTypes.method,
  SemanticTokenTypes.class,
  SemanticTokenTypes.keyword,
  SemanticTokenTypes.property,
];

const tokenTypesLegend = new Map(
  tokenTypes.map((value, index) => [value, index]),
);

export const tokenModifiers = [SemanticTokenModifiers.definition];

const tokenModifiersLegend = new Map(
  tokenModifiers.map((value, index) => [value, index]),
);

export async function doSemanticTokens(
  document: TextDocument,
): Promise<SemanticTokens> {
  const builder = new SemanticTokensBuilder();
  const yDocuments = parseAllDocuments(document.getText());
  for (const yDoc of yDocuments) {
    if (yDoc.contents) {
      await markSemanticTokens([yDoc.contents], builder, document);
    }
  }
  return builder.build();
}

async function markSemanticTokens(
  path: Node[],
  builder: SemanticTokensBuilder,
  document: TextDocument,
): Promise<void> {}

function markModuleParameters(
  moduleParamMap: YAMLMap,
  options: Map<string, IOption> | undefined,
  builder: SemanticTokensBuilder,
  document: TextDocument,
) {
  for (const moduleParamPair of moduleParamMap.items) {
    if (isScalar(moduleParamPair.key)) {
      const option = options?.get(
        (moduleParamPair.key.value as any).toString(),
      );
      if (option) {
        markNode(
          moduleParamPair.key,
          SemanticTokenTypes.method,
          [],
          builder,
          document,
        );
        if (option.type === 'dict' && isMap(moduleParamPair.value)) {
          // highlight sub-parameters
          markModuleParameters(
            moduleParamPair.value,
            option.suboptions,
            builder,
            document,
          );
        } else if (option.type === 'list' && isSeq(moduleParamPair.value)) {
          // highlight list of sub-parameters
          for (const item of moduleParamPair.value.items) {
            if (isMap(item)) {
              markModuleParameters(item, option.suboptions, builder, document);
            } else {
              markAllNestedKeysAsOrdinary(item as Node, builder, document);
            }
          }
        } else {
          markAllNestedKeysAsOrdinary(
            moduleParamPair.value as Node,
            builder,
            document,
          );
        }
      } else {
        markAllNestedKeysAsOrdinary(
          moduleParamPair.value as Node,
          builder,
          document,
        );
      }
    } else if (isNode(moduleParamPair.value)) {
      markAllNestedKeysAsOrdinary(moduleParamPair.value, builder, document);
    }
  }
}

function markAllNestedKeysAsOrdinary(
  node: Node,
  builder: SemanticTokensBuilder,
  document: TextDocument,
) {
  if (isPair(node)) {
    if (isScalar(node.key)) {
      markOrdinaryKey(node.key, builder, document);
    }
    if (isNode(node.value)) {
      markAllNestedKeysAsOrdinary(node.value, builder, document);
    }
  } else if (isMap(node)) {
    for (const pair of node.items) {
      markAllNestedKeysAsOrdinary(pair as unknown as Scalar, builder, document);
    }
  } else if (isSeq(node)) {
    for (const item of node.items) {
      if (isNode(item)) {
        markAllNestedKeysAsOrdinary(item, builder, document);
      }
    }
  }
}

function markKeyword(
  node: Scalar,
  builder: SemanticTokensBuilder,
  document: TextDocument,
) {
  markNode(node, SemanticTokenTypes.keyword, [], builder, document);
}

function markOrdinaryKey(
  node: Scalar,
  builder: SemanticTokensBuilder,
  document: TextDocument,
) {
  markNode(
    node,
    SemanticTokenTypes.property,
    [SemanticTokenModifiers.definition],
    builder,
    document,
  );
}

function markNode(
  node: Scalar,
  tokenType: SemanticTokenTypes,
  semanticTokenModifiers: SemanticTokenModifiers[],
  builder: SemanticTokensBuilder,
  document: TextDocument,
) {
  const range = getOrigRange(node);
  if (range) {
    const lspRange = toLspRange(range, document);
    const startPosition = document.positionAt(lspRange[0]);
    const length = lspRange[1] - lspRange[0];
    builder.push(
      startPosition.line,
      startPosition.character,
      length,
      encodeTokenType(tokenType),
      encodeTokenModifiers(semanticTokenModifiers),
    );
  }
}

function encodeTokenType(tokenType: SemanticTokenTypes) {
  const tokenTypeIndex = tokenTypesLegend.get(tokenType);
  if (tokenTypeIndex === undefined) {
    throw new Error(`The '${tokenType}' token type is not in legend`);
  }
  return tokenTypeIndex;
}

function encodeTokenModifiers(
  semanticTokenModifiers: SemanticTokenModifiers[],
): number {
  let encodedModifiers = 0;
  for (const tokenModifier of semanticTokenModifiers) {
    const tokenModifierIndex = tokenModifiersLegend.get(tokenModifier);
    if (tokenModifierIndex === undefined) {
      throw new Error(`The '${tokenModifier}' token modifier is not in legend`);
    }
    encodedModifiers |= (1 << tokenModifierIndex) >>> 0;
  }
  return encodedModifiers;
}
