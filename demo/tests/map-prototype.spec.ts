import { test, expect } from '@playwright/test';

test('map pans and zooms, searches its viewport and resets', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Skip intro',exact:true}).click();
  await page.getByRole('button', {name:'Explore tables first',exact:true}).click();
  const map = page.getByRole('region', {name:'Explore meals map'});
  const before = await map.locator('.demo-map-world').getAttribute('style');
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x+box.width*.45,box.y+box.height*.75);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height*.85,{steps:12});
  await page.mouse.up();
  await expect(map.locator('.demo-map-world')).not.toHaveAttribute('style',before!);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await map.getByRole('button',{name:'Zoom in',exact:true}).click();
  await expect(map).toHaveAttribute('data-zoom','1.3');
  await map.getByRole('button',{name:'Search this area',exact:true}).click();
  await expect(map.getByRole('button',{name:'Search this area',exact:true})).toHaveCount(0);
  await map.getByRole('button',{name:'Show central London',exact:true}).click();
  await expect(map).toHaveAttribute('data-zoom','1.0');
  await expect(page.getByRole('button',{name:'Soho: 2 meals',exact:true})).toBeVisible();
  await page.screenshot({path:'qa/map-helper-update/discovery.png'});
});

test('restaurant search and map selection require explicit confirmation', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Skip intro',exact:true}).click();
  await page.getByRole('button',{name:'Explore tables first',exact:true}).click();
  await page.getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByRole('radio',{name:'Log in',exact:true}).check();
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  await page.getByRole('button',{name:'Continue as Alex',exact:true}).click();
  await page.getByRole('button',{name:'Create meal',exact:true}).click();
  const map=page.getByRole('region',{name:'Restaurant map'});
  await map.getByRole('button',{name:'Show Casa Evening',exact:true}).click();
  await expect(page.locator('.venue-selection-status')).toContainText('The Little Table');
  await page.getByRole('button',{name:'Use this restaurant',exact:true}).click();
  await expect(page.locator('.venue-selection-status')).toContainText('Casa Evening');
  await page.getByRole('textbox',{name:'Search restaurants or areas',exact:true}).fill('no such venue');
  await expect(page.getByText('No restaurants match. Try another name or area.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Use this restaurant',exact:true})).toHaveCount(0);
  await page.getByRole('textbox',{name:'Search restaurants or areas',exact:true}).fill('Seasonal');
  await page.keyboard.press('Tab');
  await page.getByRole('button',{name:'The Garden Kitchen St James’s · Seasonal',exact:true}).click();
  await page.getByRole('button',{name:'Use this restaurant',exact:true}).click();
  await expect(page.locator('.venue-selection-status')).toContainText('The Garden Kitchen');
  await expect(page.getByTestId('keyboard-dock')).toHaveAttribute('data-visible','false');
  await expect.poll(async()=>page.getByTestId('keyboard-dock').evaluate(el=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42-el.getBoundingClientRect().height))).toBeLessThan(1);
  await page.getByTestId('mobile-scroll').evaluate(el=>{el.scrollTop=0;});
  await page.screenshot({path:'qa/map-helper-update/create-restaurant.png'});
  await page.getByRole('group',{name:'Available times',exact:true}).getByRole('radio').first().check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('button',{name:'2 Introduce',exact:true})).toHaveAttribute('aria-current','step');
});

test('touch pointer moves the sprite without opening a conversation', async ({page,context}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Skip intro',exact:true}).click();
  await page.getByRole('button',{name:'Explore tables first',exact:true}).click();
  const sprite=page.getByRole('button',{name:'Open Fancy helper',exact:true});
  const box=(await sprite.boundingBox())!;
  const before=await page.locator('.helper-launcher').getAttribute('style');
  const cdp=await context.newCDPSession(page);
  const point={x:box.x+box.width/2,y:box.y+box.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let i=1;i<=10;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-i*9,y:point.y+i*7}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.helper-launcher')).not.toHaveAttribute('style',before!);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await sprite.click();
  await expect(page.locator('.helper-tools').getByRole('button',{name:'My preferences',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Close Fancy helper',exact:true})).toHaveCount(0);
  await expect.poll(async()=>page.getByTestId('bottom-sheet').evaluate(el=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))).toBeLessThan(.5);
  await page.screenshot({path:'qa/map-helper-update/helper.png'});
});

test('touch pinch zooms the map and viewport search handles empty areas', async ({page,context}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Skip intro',exact:true}).click();
  await page.getByRole('button',{name:'Explore tables first',exact:true}).click();
  const map=page.getByRole('region',{name:'Explore meals map'});
  const box=(await map.boundingBox())!;
  const cdp=await context.newCDPSession(page);
  const fingers=(spread:number)=>[{id:0,x:box.x+box.width*.4-spread,y:box.y+box.height*.6},{id:1,x:box.x+box.width*.6+spread,y:box.y+box.height*.6}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:fingers(0)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:fingers(30)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(1);
  await map.focus();
  for(let i=0;i<5;i++) await map.press('+');
  for(let i=0;i<20;i++) { await map.press('ArrowLeft'); await map.press('ArrowUp'); }
  await map.getByRole('button',{name:'Search this area',exact:true}).click();
  await expect(page.getByText('No meals in this area',{exact:true})).toBeVisible();
  await map.getByRole('button',{name:'Show central London',exact:true}).click();
  await expect(page.getByRole('heading',{name:'An easy Friday supper',exact:true})).toBeVisible();
});
