import BaseStep from './base-step';

export default class DestroyDatoSchema extends BaseStep {
  async task(): Promise<void> {
    const wpItemTypes = await this.client.itemTypes.list();

    const itemTypesToDestroy = wpItemTypes.filter((it) =>
      ['wp_article', 'wp_page', 'wp_author', 'wp_category', 'wp_tag'].includes(
        it.api_key,
      ),
    );

    for (const itemType of itemTypesToDestroy) {
      const confirmed =
        this.autoconfirm ||
        (await this.listrTask.prompt<boolean>({
          type: 'Confirm',
          message: `A model named "${itemType.api_key}" already exist in the project. Confirm that you want to destroy it?`,
        }));

      if (!confirmed) {
        throw new Error('Import interrupted by user request');
      }

      await this.client.itemTypes.destroy(itemType);
    }
  }
}
