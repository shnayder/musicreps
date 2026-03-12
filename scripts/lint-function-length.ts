#!/usr/bin/env -S deno run --allow-read
// Custom lint rule: check for overly long functions using TypeScript AST
// Run as: deno run --allow-read scripts/lint-function-length.ts

import ts from 'npm:typescript@5.3.3';

const MAX_FUNCTION_LINES = 100;
const EXCLUSIONS = new Set([
  'main.ts', // Build script with multiple top-level commands
  'preview.tsx', // Component gallery — each section is trivial
  'build-template.ts', // HTML template assembly — declarative data
]);

interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  length: number;
}

function getFunctionName(node: ts.Node): string | null {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.getText() ?? '<anonymous>';
  }
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (
      declaration &&
      declaration.initializer &&
      (ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer))
    ) {
      return declaration.name.getText();
    }
  }
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    return node.name.getText();
  }
  return null;
}

function findFunctions(content: string, filePath: string): FunctionInfo[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const functions: FunctionInfo[] = [];

  function visit(node: ts.Node) {
    // Check if this is a function-like node
    const isFunctionLike = ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node);

    // Check for arrow functions in variable declarations
    let isArrowInDeclaration = false;
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (
        declaration?.initializer &&
        ts.isArrowFunction(declaration.initializer)
      ) {
        isArrowInDeclaration = true;
      }
    }

    if (isFunctionLike || isArrowInDeclaration) {
      const name = getFunctionName(node);
      if (name) {
        const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(
          node.getEnd(),
        );
        const length = endLine - startLine + 1;

        functions.push({
          name,
          startLine: startLine + 1, // 1-indexed
          endLine: endLine + 1, // 1-indexed
          length,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

async function checkFile(filePath: string): Promise<boolean> {
  const content = await Deno.readTextFile(filePath);
  const functions = findFunctions(content, filePath);
  let hasViolations = false;

  for (const func of functions) {
    if (func.length > MAX_FUNCTION_LINES) {
      console.error(
        `${filePath}:${func.startLine}: Function "${func.name}" is ${func.length} lines (max ${MAX_FUNCTION_LINES})`,
      );
      hasViolations = true;
    }
  }

  return hasViolations;
}

async function checkDirectory(dir: string): Promise<boolean> {
  let hasViolations = false;

  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;

    // Skip excluded directories
    if (
      entry.isDirectory &&
      (entry.name === 'node_modules' ||
        entry.name === 'docs' ||
        entry.name === '.git')
    ) {
      continue;
    }

    if (entry.isDirectory) {
      const dirViolations = await checkDirectory(path);
      hasViolations = hasViolations || dirViolations;
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('_test.ts') && // Skip test files
      !EXCLUSIONS.has(entry.name)
    ) {
      const fileViolations = await checkFile(path);
      hasViolations = hasViolations || fileViolations;
    }
  }

  return hasViolations;
}

// Main
const hasViolations = await checkDirectory('src');

if (hasViolations) {
  console.error(
    `\nFound functions exceeding ${MAX_FUNCTION_LINES} lines. Consider refactoring.`,
  );
  Deno.exit(1);
} else {
  console.log('✓ All functions are within the line limit');
}
