let Xdotoolify = require('../src/xdotoolify').default;

let noop = () => {};

describe('xdotoolify', function() {
  let page = null;

  beforeEach(async function() {
    page = {};
    Xdotoolify(page);
  });

  it('should throw error if not setup', async function() {
    let errorMsg = 'No error thrown';
    let badFunc = () => {};

    try {
      await page.X.check(badFunc, noop).do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toContain('you must call Xdotoolify.setupWithPage');
  });

  it('should throw error on bad check', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => {});

    try {
      await page.X.check(goodFunc, () => { throw new Error('inside'); }).do({
        unsafe: true
      });
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toContain('inside');
  });

  it('should print check values on bad check', async function() {
    let errorMsg = 'Nothing thrown';
    let stack = 'nothing';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return [{a: 5}, 6]; });

    try {
      await page.X.check(goodFunc, () => { throw new Error('inside'); }).do({
        unsafe: true
      });
    } catch (e) {
      errorMsg = e.message;
      stack = e.stack;
    }

    expect(errorMsg).toContain('inside');
    expect(stack).toContain(' [{"a":5},6]\n');
  });

  it('should be able to handle circular objects in check', async function() {
    const circularObject = {};
    circularObject.b = circularObject;

    let stack = 'empty stack';
    let badFunc = Xdotoolify.setupWithPage((page) => { return circularObject; });

    try {
      await page.X.check(badFunc, () => {
        throw new Error('callback');
      }).do({unsafe: true});
    } catch (e) {
      stack = e.stack;
    }

    expect(stack).toContain('Value being checked: TypeError: Converting circular structure to JSON');
  });

  it('should work with new checkUntil', async function() {
    let stack = 'nothing';
    let goodFunc = Xdotoolify.setupWithPage((page) => [{a: 4}, {b: 6}]);
    await page.X
        .checkUntil(goodFunc, x => {
          try {
            expect(x.a).toBe(4);
          } catch (e) {
            return false;
          }
          return true;
        }, true)
        .do({legacyCheckUntil: false});

    await expect(async () => {
      await page.X
          .checkUntil(goodFunc, x => expect(x.a).toBe(5), true)
          .do({legacyCheckUntil: false});
    }).rejects.toThrow();
  }, 15000);

  it('should print checkUntil values on bad check', async function() {
    let stack = 'nothing';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return [{a: 5}, 6]; });

    try {
      await page.X.checkUntil(goodFunc, x => x[0].a, 4).do();
    } catch (e) {
      stack = e.stack;
    }

    expect(stack).toContain(' [{"a":5},6]\n');
    expect(stack).toContain(' 5\n');
  });

  it('should work with checkUntil', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });

    try {
      await page.X.checkUntil(goodFunc, x => x * 2, 10).do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');
  });

  it('should throw an error on checkUntil timeout', async function() {
    let stack = 'nothing';

    let value = 4;

    let slowFunc = Xdotoolify.setupWithPage(async (page) => {
      return value;
    });

    setTimeout(() => {
      value = 5;
    }, 4000)

    try {
      await page.X.checkUntil(slowFunc, x => x, 5).do();
    } catch (e) {
      stack = e.stack;
    }

    expect(stack).toContain('Timeout exceeded waiting for  called with  to be 5.\n');
  });

  it('should be able to customize checkUntil timeout', async function() {
    let stack = 'nothing';

    let value = 4;

    Xdotoolify.defaultCheckUntilTimeout = 5000;

    let slowFunc = Xdotoolify.setupWithPage(async (page) => {
      return value;
    });

    setTimeout(() => {
      value = 5;
    }, 4000)

    try {
      await page.X.checkUntil(slowFunc, x => x, 5).do();
    } catch (e) {
      stack = e.stack;
    }

    expect(stack).toContain('nothing');

    Xdotoolify.defaultCheckUntilTimeout = 3000;
  });

  it('should be able to handle circular objects in checkUntil', async function() {
    const circularObject = {};
    circularObject.b = circularObject;

    let errorMsg = 'Nothing thrown';
    let badFunc = Xdotoolify.setupWithPage((page) => { return circularObject; });

    try {
      await page.X.checkUntil(badFunc, x => x, 10).do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toContain('Most recent value: TypeError: Converting circular structure to JSON');
  });

  it('should throw error when missing do() at the end of run command', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });
    const withDo = Xdotoolify.setupWithPage((page) => {
      return page.X
          .checkUntil(goodFunc, x => x * 2, 10)
          .do();
    });
    const withoutDo = Xdotoolify.setupWithPage((page) => {
      return page.X
          .checkUntil(goodFunc, x => x * 2, 10);
    });

    try {
      await page.X
          .run(withDo)
          .checkUntil(goodFunc, x => x * 2, 10).do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    try {
      await page.X
          .run(withoutDo)
          .checkUntil(goodFunc, x => x * 2, 10).do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('You forgot to add ".do() "at the end of a subcommand.');
  });

  it('should throw error when missing checkUntil after interaction', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });
    let withCheck = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .checkUntil(goodFunc, x => x * 2, 10)
          .do();
    });

    try {
      await page.X
          .run(withCheck)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    withCheck = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .checkNothing()
          .do();
    });

    try {
      await page.X
          .run(withCheck)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    let withoutCheck = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .do({unsafe: true});
    });

    try {
      await page.X
          .run(withoutCheck)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Unsafe do() calls are not allowed within safe ones.');

    withoutCheck = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .do();
    });

    try {
      await page.X
          .run(withoutCheck)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Missing checkUntil after interaction.');
  });

  it('should handle safe calls after unsafe ones and nested calls', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });

    let withCheck = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .checkUntil(goodFunc, x => x * 2, 10)
          .do();
    });
    let withoutCheckUnsafe = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .do({unsafe: true});
    });
    let withoutCheckSafe = Xdotoolify.setupWithPage((page) => {
      return page.X
          .click()
          .do();
    });

    try {
      await page.X
          .run(withCheck)
          .do();
      await page.X
          .run(withoutCheckUnsafe)
          .do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    let safelyWrappedWithoutCheckUnsafe = Xdotoolify.setupWithPage((page) => {
      return page.X
          .run(withoutCheckUnsafe)
          .do();
    });
    let safelyWrappedWithoutCheckSafe = Xdotoolify.setupWithPage((page) => {
      return page.X
          .run(withoutCheckSafe)
          .do();
    });
    let safelyWrappedWithCheckSafe = Xdotoolify.setupWithPage((page) => {
      return page.X
          .run(withCheck)
          .checkUntil(goodFunc, x => x * 2, 10)
          .do();
    });

    // unsafe > safe > unsafe
    try {
      await page.X
          .run(safelyWrappedWithoutCheckUnsafe)
          .do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Unsafe do() calls are not allowed within safe ones.');

    errorMsg = 'Nothing thrown';

    // unsafe > safe > safe
    try {
      await page.X
          .run(safelyWrappedWithCheckSafe)
          .do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    // unsafe > safe > safe (with missing checkUntil)
    try {
      await page.X
          .run(safelyWrappedWithoutCheckSafe)
          .do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Missing checkUntil after interaction.');
  });

  it('should not allow check statements in safe do call', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });
    const noop = () => {};

    try {
      await page.X
          .check(goodFunc, noop)
          .do({unsafe: true});
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    try {
      await page.X
          .check(goodFunc, noop)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe(
      '\'check\' actions are now deprecated. Please rewrite' +
      ' as \'checkUntil\'.'
    );
  });

  it('should require check after addRequireCheckImmediatelyAfter', async function() {
    let errorMsg = 'Nothing thrown';
    let goodFunc = Xdotoolify.setupWithPage((page) => { return 5; });
    let fnWithRequire = Xdotoolify.setupWithPage(
      async (page) => {
        await page.X
            .addRequireCheckImmediatelyAfter().do();
      }
    );
    const noop = () => {};

    try {
      await page.X
          .run(goodFunc)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    try {
      await page.X
          .run(goodFunc)
          .run(fnWithRequire)
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe(
      'Missing checkUntil after running ' +
      '\'requireCheckImmediatelyAfter\'.'
    );

    errorMsg = null;

    try {
      await page.X
          .run(goodFunc)
          .addRequireCheckImmediatelyAfter()
          .do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe(
      'Missing checkUntil after running ' +
      '\'requireCheckImmediatelyAfter\'.'
    );
  });

  it('should compare objects', async function() {
    let goodFunc = Xdotoolify.setupWithPage((page) => { return {
      a: 1,
      b: 2
    }; });

    let errorMsg = 'Nothing thrown';

    try {
      await page.X.checkUntil(goodFunc, x => x, {
        a: 1,
        b: 2
      }).do();
    } catch (e) {
      errorMsg = e.message;
    }

    expect(errorMsg).toBe('Nothing thrown');

    try {
      await page.X.checkUntil(goodFunc, x => x, {
        a: 2,
        b: 2
      }).do();
    } catch (e) {
      errorMsg = e.message;
    }
    expect(errorMsg).toBe(
      'Timeout exceeded waiting for  called with  ' +
      'to be {"a":2,"b":2}.\n' +
      'Most recent value: {"a":1,"b":2}\n' +
      'Most recent check result: {"a":1,"b":2}\n'
    );

  });
});
