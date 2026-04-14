import Matter from 'matter-js';

import { Ball, Cue, Table } from '@/engine/types';

const { Engine, Bodies, Body, Composite } = Matter;

const PHYSICS_CONFIG: Matter.IEngineDefinition = {
  gravity: { x: 0, y: 0 },
  positionIterations: 10,
  velocityIterations: 10,
  constraintIterations: 4,
  enableSleeping: false,
};

export function createPhysicsWorld(): Matter.Engine {
  const engine = Engine.create(PHYSICS_CONFIG);
  engine.timing.timeScale = 1;
  engine.timing.timestamp = 0;
  return engine;
}

export function createBallBody(ball: Ball): Matter.Body {
  return Bodies.circle(ball.position.x, ball.position.y, ball.radius, {
    restitution: 0.98,
    friction: 0.005,
    frictionAir: 0.008,
    density: 0.002,
    label: `ball-${ball.id}`,
    render: { visible: false },
  });
}

export function createTableBodies(table: Table): {
  cushionBodies: Matter.Body[];
  pocketBodies: Matter.Body[];
} {
  const { width, height } = table;
  const topLeftPocket = table.pockets.find(pocket => pocket.id === 'tl');
  const topCenterPocket = table.pockets.find(pocket => pocket.id === 'tc');
  const topRightPocket = table.pockets.find(pocket => pocket.id === 'tr');
  const bottomLeftPocket = table.pockets.find(pocket => pocket.id === 'bl');
  const bottomCenterPocket = table.pockets.find(pocket => pocket.id === 'bc');
  const bottomRightPocket = table.pockets.find(pocket => pocket.id === 'br');

  if (
    !topLeftPocket ||
    !topCenterPocket ||
    !topRightPocket ||
    !bottomLeftPocket ||
    !bottomCenterPocket ||
    !bottomRightPocket
  ) {
    throw new Error('Expected six pockets configured on the table.');
  }

  const cushionDepth = Math.max(table.cushionWidth + 8, 24);
  const segmentInset = cushionDepth * 0.75;
  const cornerRadius = topLeftPocket.radius * 0.72;
  const cornerInset = topLeftPocket.radius * 1.22;
  const centerPocketRadius = topCenterPocket.radius;

  const cushionBodies: Matter.Body[] = [
    Bodies.rectangle(
      (topLeftPocket.position.x + topCenterPocket.position.x) / 2,
      segmentInset,
      topCenterPocket.position.x - topLeftPocket.position.x - topLeftPocket.radius * 1.8,
      cushionDepth,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-top-left',
      }
    ),
    Bodies.rectangle(
      (topCenterPocket.position.x + topRightPocket.position.x) / 2,
      segmentInset,
      topRightPocket.position.x - topCenterPocket.position.x - topRightPocket.radius * 1.8,
      cushionDepth,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-top-right',
      }
    ),
    Bodies.rectangle(
      (bottomLeftPocket.position.x + bottomCenterPocket.position.x) / 2,
      height - segmentInset,
      bottomCenterPocket.position.x - bottomLeftPocket.position.x - bottomLeftPocket.radius * 1.8,
      cushionDepth,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-bottom-left',
      }
    ),
    Bodies.rectangle(
      (bottomCenterPocket.position.x + bottomRightPocket.position.x) / 2,
      height - segmentInset,
      bottomRightPocket.position.x - bottomCenterPocket.position.x - bottomRightPocket.radius * 1.8,
      cushionDepth,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-bottom-right',
      }
    ),
    Bodies.rectangle(
      segmentInset,
      height / 2,
      cushionDepth,
      height - (topLeftPocket.radius + bottomLeftPocket.radius) * 1.95,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-left',
      }
    ),
    Bodies.rectangle(
      width - segmentInset,
      height / 2,
      cushionDepth,
      height - (topRightPocket.radius + bottomRightPocket.radius) * 1.95,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0.001,
        label: 'cushion-right',
      }
    ),
    Bodies.circle(cornerInset, cornerInset, cornerRadius, {
      isStatic: true,
      restitution: 0.92,
      friction: 0.001,
      label: 'corner-tl',
    }),
    Bodies.circle(width - cornerInset, cornerInset, cornerRadius, {
      isStatic: true,
      restitution: 0.92,
      friction: 0.001,
      label: 'corner-tr',
    }),
    Bodies.circle(cornerInset, height - cornerInset, cornerRadius, {
      isStatic: true,
      restitution: 0.92,
      friction: 0.001,
      label: 'corner-bl',
    }),
    Bodies.circle(width - cornerInset, height - cornerInset, cornerRadius, {
      isStatic: true,
      restitution: 0.92,
      friction: 0.001,
      label: 'corner-br',
    }),
    Bodies.circle(width / 2 - centerPocketRadius * 1.6, segmentInset + centerPocketRadius * 0.9, centerPocketRadius * 0.56, {
      isStatic: true,
      restitution: 0.9,
      friction: 0.001,
      label: 'corner-tc-left',
    }),
    Bodies.circle(width / 2 + centerPocketRadius * 1.6, segmentInset + centerPocketRadius * 0.9, centerPocketRadius * 0.56, {
      isStatic: true,
      restitution: 0.9,
      friction: 0.001,
      label: 'corner-tc-right',
    }),
    Bodies.circle(width / 2 - centerPocketRadius * 1.6, height - segmentInset - centerPocketRadius * 0.9, centerPocketRadius * 0.56, {
      isStatic: true,
      restitution: 0.9,
      friction: 0.001,
      label: 'corner-bc-left',
    }),
    Bodies.circle(width / 2 + centerPocketRadius * 1.6, height - segmentInset - centerPocketRadius * 0.9, centerPocketRadius * 0.56, {
      isStatic: true,
      restitution: 0.9,
      friction: 0.001,
      label: 'corner-bc-right',
    }),
  ];

  const pocketBodies = table.pockets.map(pocket =>
    Bodies.circle(pocket.position.x, pocket.position.y, pocket.radius, {
      isStatic: true,
      isSensor: true,
      label: `pocket-${pocket.id}`,
    })
  );

  return { cushionBodies, pocketBodies };
}

export function createCushions(table: Table): Matter.Body[] {
  return createTableBodies(table).cushionBodies;
}

export function createPocketSensors(table: Table): Matter.Body[] {
  return createTableBodies(table).pocketBodies;
}

export function applyCueStrike(whiteBallBody: Matter.Body, cue: Cue): void {
  const force = cue.power * 0.00095;
  const angleRad = (cue.angle * Math.PI) / 180;

  Body.setAngularVelocity(whiteBallBody, cue.spin.x * 0.08);
  Body.applyForce(whiteBallBody, whiteBallBody.position, {
    x: Math.cos(angleRad) * force,
    y: Math.sin(angleRad) * force,
  });
}

export function syncBallsFromBodies(
  balls: Ball[],
  ballBodies: Map<string, Matter.Body>
): Ball[] {
  return balls.map(ball => {
    const body = ballBodies.get(ball.id);
    if (!body) {
      return ball;
    }

    return {
      ...ball,
      position: { x: body.position.x, y: body.position.y },
      velocity: { x: body.velocity.x, y: body.velocity.y },
    };
  });
}

export function isWorldSleeping(engine: Matter.Engine): boolean {
  const dynamicBodies = Composite.allBodies(engine.world).filter(body => body.label.startsWith('ball-'));
  return dynamicBodies.every(body => body.speed < 0.05 && Math.abs(body.angularSpeed) < 0.05);
}
